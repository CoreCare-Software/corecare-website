#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

function fail(message) {
  console.error(`FAIL CoreCare pre-push: ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    fail(`could not read ${relativePath}: ${error.message}`);
  }
}

const packageManifest = readJson('package.json');
const config = readJson('.corecare/pre-push.json');
if (config.protocol !== 'corecare-local-pre-push/1') fail('unsupported .corecare/pre-push.json protocol');
if (config.standard !== 'CORECARE_ENGINEERING_OPERATING_STANDARD_V1') fail('canonical engineering standard is not declared');
if (!Array.isArray(config.scripts) || config.scripts.length === 0) fail('at least one local gate script is required');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const useShell = process.platform === 'win32';
const scripts = packageManifest.scripts || {};

function unsafeScript(name, command) {
  const loweredName = name.toLowerCase();
  const loweredCommand = String(command).toLowerCase();
  if (/(^|:)(deploy|publish|promote|upload)(:|$)/u.test(loweredName)) return 'mutation-capable script name';
  if (/db:migrate:(remote|staging|production)/u.test(loweredName)) return 'remote migration script name';
  if (/wrangler\s+versions\s+upload/u.test(loweredCommand)) return 'Worker version upload command';
  if (/wrangler\s+d1\s+migrations\s+apply[^\n]*--remote/u.test(loweredCommand)) return 'remote D1 migration command';
  if (/wrangler\s+deploy/u.test(loweredCommand) && !/--dry-run/u.test(loweredCommand)) return 'non-dry-run Wrangler deploy command';
  return null;
}

const plan = [];
for (const name of config.scripts) {
  if (typeof name !== 'string' || !name.trim()) fail('every configured script must be a non-empty string');
  const command = scripts[name];
  if (typeof command !== 'string' || !command.trim()) fail(`package.json is missing script ${name}`);
  const unsafeReason = unsafeScript(name, command);
  if (unsafeReason) fail(`refusing ${name} (${unsafeReason})`);
  plan.push({ name, command });
}

if (process.argv.includes('--plan')) {
  for (const item of plan) console.log(`${item.name}: ${item.command}`);
  process.exit(0);
}

console.log(`CoreCare pre-push: running ${plan.map((item) => item.name).join(', ')}`);
for (const item of plan) {
  console.log(`\n> npm run ${item.name}`);
  const result = spawnSync(npmCommand, ['run', '--silent', item.name], {
    cwd: root,
    stdio: 'inherit',
    shell: useShell,
    env: { ...process.env, CORECARE_PRE_PUSH: '1' },
  });
  if (result.error) fail(`${item.name} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${item.name} exited ${result.status}`);
}
console.log('\nPASS CoreCare local pre-push gate');
