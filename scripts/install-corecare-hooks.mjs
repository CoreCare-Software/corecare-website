#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function environmentFlag(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && !['0', 'false', 'no', 'off'].includes(normalized);
}

if (environmentFlag(process.env.CI) || environmentFlag(process.env.GITHUB_ACTIONS)) {
  console.log('CoreCare hooks: CI environment detected; local Git configuration unchanged.');
  process.exit(0);
}

function fail(message) {
  console.error(`FAIL CoreCare hooks: ${message}`);
  process.exit(1);
}

const expectedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function git(args) {
  const result = spawnSync('git', args, { cwd: expectedRoot, encoding: 'utf8', windowsHide: true });
  if (result.error) fail(`git ${args.join(' ')} could not start: ${result.error.message}`);
  return result;
}

const rootResult = git(['rev-parse', '--show-toplevel']);
if (rootResult.status !== 0) fail(rootResult.stderr?.trim() || 'not inside a Git worktree');
const actualRoot = path.resolve(rootResult.stdout.trim());
if (actualRoot.toLowerCase() !== expectedRoot.toLowerCase()) fail(`repository root mismatch (${actualRoot})`);

const setResult = git(['config', '--local', 'core.hooksPath', '.githooks']);
if (setResult.status !== 0) fail(setResult.stderr?.trim() || 'could not configure core.hooksPath');
const verify = git(['config', '--local', '--get', 'core.hooksPath']);
if (verify.status !== 0 || verify.stdout.trim() !== '.githooks') fail('core.hooksPath did not verify as .githooks');
console.log('PASS CoreCare hooks installed: core.hooksPath=.githooks');
