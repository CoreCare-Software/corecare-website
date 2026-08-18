#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

function fail(message, code = 1) {
  console.error(`FAIL CoreCare pre-push: ${message}`);
  process.exit(code);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    fail(`cannot read ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const packageManifest = readJson('package.json');
const config = readJson('.corecare/pre-push.json');
if (config.protocol !== 'corecare-local-pre-push/1') fail('unsupported .corecare/pre-push.json protocol');
if (config.standard !== 'CORECARE_ENGINEERING_OPERATING_STANDARD_V1') fail('canonical engineering standard is not declared');
if (!Array.isArray(config.scripts) || config.scripts.length === 0) fail('at least one local gate script is required');

const scripts = packageManifest.scripts || {};
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const useShell = process.platform === 'win32';

function referencedNpmScripts(command) {
  const references = [];
  const pattern = /\bnpm(?:\.cmd)?\s+(?:run|run-script)\s+([A-Za-z0-9:_-]+)/giu;
  for (const match of String(command).matchAll(pattern)) references.push(match[1]);
  return references;
}

function unsafeCommand(name, command) {
  const loweredName = name.toLowerCase();
  if (/(^|:)(deploy|publish|promote|upload)(:|$)/u.test(loweredName)) return 'mutation-capable script name';
  if (/db:migrate:(remote|staging|production)/u.test(loweredName)) return 'remote migration script name';
  for (const segment of String(command).split(/&&|\|\||;|[\r\n]+|[&|]/u)) {
    const lowered = segment.toLowerCase();
    if (/wrangler\s+versions\s+upload/u.test(lowered)) return 'Worker version upload command';
    if (/wrangler\s+d1\s+migrations\s+apply[^\n]*--remote/u.test(lowered)) return 'remote D1 migration command';
    if (/wrangler\s+deploy/u.test(lowered)) {
      if (/--dry-run\s*=/u.test(lowered)) return 'non-bare Wrangler --dry-run option';
      if (!/(?:^|\s)--dry-run(?:\s|$)/u.test(lowered)) return 'non-dry-run Wrangler deploy command';
    }
  }
  return null;
}

const validated = new Set();
function validateScript(name, stack = []) {
  if (typeof name !== 'string' || !name.trim()) fail('every configured script must be a non-empty string');
  if (validated.has(name)) return;
  if (stack.includes(name)) fail(`npm script cycle detected: ${[...stack, name].join(' -> ')}`);
  const command = scripts[name];
  if (typeof command !== 'string' || !command.trim()) fail(`package.json is missing script ${name}`);
  const unsafeReason = unsafeCommand(name, command);
  if (unsafeReason) fail(`refusing ${name} (${unsafeReason})`);
  for (const referenced of referencedNpmScripts(command)) validateScript(referenced, [...stack, name]);
  validated.add(name);
}

for (const name of config.scripts) validateScript(name);
if (process.argv.includes('--plan')) {
  for (const name of config.scripts) console.log(`${name}: ${scripts[name]}`);
  process.exit(0);
}

console.log(`CoreCare pre-push: running ${config.scripts.join(', ')}`);
for (const name of config.scripts) {
  console.log(`\n> npm run ${name}`);
  const result = spawnSync(npmCommand, ['run', '--silent', name], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: useShell,
    env: { ...process.env, CORECARE_PRE_PUSH: '1' },
  });
  if (result.error) fail(`${name} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${name} exited ${result.status}`, result.status || 1);
}
console.log('\nPASS CoreCare local pre-push gate');
