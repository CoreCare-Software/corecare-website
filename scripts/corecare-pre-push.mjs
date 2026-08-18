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

function commandSegments(command) {
  return String(command).split(/&&|\|\||;|[\r\n]+|[&|]/u);
}

function matchingBoundaryQuote(token) {
  if (typeof token !== 'string' || token.length < 2) return null;
  const first = token[0];
  const last = token[token.length - 1];
  return (first === '"' || first === "'") && first === last ? first : null;
}

function stripTokenQuotes(token) {
  return matchingBoundaryQuote(token) ? token.slice(1, -1) : token;
}

function rawCommandTokens(segment) {
  return segment.trim().split(/\s+/u).filter(Boolean);
}

function commandTokens(segment) {
  return rawCommandTokens(segment).map(stripTokenQuotes);
}

function hasSplitBoundaryQuote(token) {
  const first = token[0];
  const last = token[token.length - 1];
  const startsQuoted = first === '"' || first === "'";
  const endsQuoted = last === '"' || last === "'";
  return (startsQuoted || endsQuoted) && !matchingBoundaryQuote(token);
}

function referencedNpmScripts(command) {
  const references = [];
  for (const segment of commandSegments(command)) {
    const rawTokens = rawCommandTokens(segment);
    const tokens = rawTokens.map(stripTokenQuotes);
    for (let index = 0; index < tokens.length; index += 1) {
      if (!/^npm(?:\.cmd)?$/iu.test(tokens[index])) continue;
      const runIndex = tokens.findIndex((token, candidate) => candidate > index && /^(?:run|run-script)$/iu.test(token));
      if (runIndex === -1) continue;
      const rawScript = rawTokens[runIndex + 1];
      const script = tokens[runIndex + 1];
      if (!rawScript || hasSplitBoundaryQuote(rawScript) || !script || script.startsWith('-') || !/^[A-Za-z0-9:_-]+$/u.test(script)) {
        fail(`cannot safely parse nested npm run in script command: ${segment.trim()}`);
      }
      references.push(script);
      index = runIndex + 1;
    }
  }
  return references;
}

function wranglerDryRunSafety(segment) {
  const tokens = commandTokens(segment);
  const lowered = tokens.map((token) => token.toLowerCase());
  let bareDryRun = false;
  for (let index = 0; index < lowered.length; index += 1) {
    const token = lowered[index];
    if (token.startsWith('--dry-run=')) return 'non-bare Wrangler --dry-run option';
    if (token !== '--dry-run') continue;
    const next = lowered[index + 1];
    if (next && !next.startsWith('-')) return 'non-bare Wrangler --dry-run option';
    bareDryRun = true;
  }
  return bareDryRun ? null : 'non-dry-run Wrangler deploy command';
}

function unsafeCommand(name, command) {
  const loweredName = name.toLowerCase();
  if (/(^|:)(deploy|publish|promote|upload)(:|$)/u.test(loweredName)) return 'mutation-capable script name';
  if (/db:migrate:(remote|staging|production)/u.test(loweredName)) return 'remote migration script name';
  for (const segment of commandSegments(command)) {
    const lowered = segment.toLowerCase();
    if (/wrangler\s+versions\s+upload/u.test(lowered)) return 'Worker version upload command';
    if (/wrangler\s+d1\s+migrations\s+apply[^\n]*--remote/u.test(lowered)) return 'remote D1 migration command';
    if (/wrangler\s+deploy(?:\s|$)/u.test(lowered)) {
      const reason = wranglerDryRunSafety(segment);
      if (reason) return reason;
    }
  }
  return null;
}

const validated = new Set();
function validateScript(name, stack = []) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9:_-]+$/u.test(name)) {
    fail(`every configured script name must use only letters, digits, :, _ or - (including referenced scripts); received ${JSON.stringify(name)}`);
  }
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
