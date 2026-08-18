#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function fail(message) {
  console.error(`FAIL CoreCare hooks: ${message}`);
  process.exit(1);
}
function environmentFlag(name) {
  const raw = process.env[name];
  if (typeof raw !== 'string' || !raw.trim()) return false;
  return !/^(?:0|false|no|off)$/iu.test(raw.trim());
}
if (environmentFlag('CI') || environmentFlag('GITHUB_ACTIONS')) {
  console.log('CoreCare hooks: CI environment detected; local Git configuration unchanged.');
  process.exit(0);
}
const expectedRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function git(args, label) {
  const result = spawnSync('git', args, { cwd: expectedRoot, encoding: 'utf8', windowsHide: true });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label}: ${result.stderr?.trim() || `git exited ${result.status}`}`);
  return result.stdout.trim();
}
const actualRoot = path.resolve(git(['rev-parse', '--show-toplevel'], 'cannot locate Git worktree'));
if (actualRoot.toLowerCase() !== expectedRoot.toLowerCase()) fail(`repository root mismatch (${actualRoot})`);
git(['config', '--local', 'core.hooksPath', '.githooks'], 'could not configure core.hooksPath');
const configured = git(['config', '--local', '--get', 'core.hooksPath'], 'could not verify core.hooksPath');
if (configured !== '.githooks') fail(`core.hooksPath verified as ${configured || '<empty>'}, expected .githooks`);
console.log('PASS CoreCare hooks installed: core.hooksPath=.githooks');
