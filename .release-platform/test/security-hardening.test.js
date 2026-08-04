import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allowedProductAccessModes,
  authenticatedRequestGuard,
  CLOUDFLARE_WORKERS_PBKDF2_MAX_ITERATIONS,
  readJson,
  secureEqualText,
} from '../src/index.js';

test('password hashing stays within the Cloudflare Workers PBKDF2 ceiling', () => {
  assert.equal(CLOUDFLARE_WORKERS_PBKDF2_MAX_ITERATIONS, 100000);
});

test('product access modes follow least privilege by platform role', () => {
  assert.deepEqual([...allowedProductAccessModes({ access_level: 'platform_owner' })], ['read_only', 'support', 'implementation', 'developer']);
  assert.equal(allowedProductAccessModes({ access_level: 'platform_admin' }).has('developer'), false);
  assert.deepEqual([...allowedProductAccessModes({ access_level: 'platform_support' })], ['read_only', 'support']);
  assert.deepEqual([...allowedProductAccessModes({ access_level: 'unexpected_role' })], ['read_only']);
});

test('unsafe authenticated requests require the same browser origin', async () => {
  const url = new URL('https://platform.corecare.example/api/platform/products');
  const wrongOrigin = new Request(url, { method: 'POST', headers: { origin: 'https://attacker.example' } });
  const rejected = authenticatedRequestGuard(wrongOrigin, url, {});
  assert.equal(rejected.status, 403);
  assert.equal((await rejected.json()).error.code, 'INVALID_REQUEST_ORIGIN');

  const sameOrigin = new Request(url, { method: 'POST', headers: { origin: url.origin } });
  assert.equal(authenticatedRequestGuard(sameOrigin, url, {}), null);
});

test('read-only support and emergency mode block server-side mutations', async () => {
  const url = new URL('https://platform.corecare.example/api/clients');
  const request = new Request(url, { method: 'POST', headers: { origin: url.origin } });
  const readOnly = authenticatedRequestGuard(request, url, { support_mode: 1, support_access_mode: 'read_only' });
  assert.equal(readOnly.status, 403);
  assert.equal((await readOnly.json()).error.code, 'READ_ONLY_SUPPORT_SESSION');

  const emergency = authenticatedRequestGuard(request, url, { emergency_mode: 1 });
  assert.equal(emergency.status, 423);
  assert.equal((await emergency.json()).error.code, 'EMERGENCY_MODE_ACTIVE');
});

test('temporary-password accounts cannot call other APIs', async () => {
  const url = new URL('https://platform.corecare.example/api/platform/dashboard');
  const request = new Request(url, { headers: { origin: url.origin } });
  const response = authenticatedRequestGuard(request, url, { must_change_password: 1 });
  assert.equal(response.status, 428);
  assert.equal((await response.json()).error.code, 'PASSWORD_CHANGE_REQUIRED');
});

test('JSON parsing rejects wrong content types and oversized requests', async () => {
  await assert.rejects(
    readJson(new Request('https://platform.example/api', { method: 'POST', body: '{}' }), 100),
    error => error.status === 415 && error.code === 'JSON_REQUIRED',
  );
  await assert.rejects(
    readJson(new Request('https://platform.example/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'x'.repeat(200) }) }), 100),
    error => error.status === 413 && error.code === 'REQUEST_TOO_LARGE',
  );
});

test('service credentials use constant-time digest comparison', async () => {
  assert.equal(await secureEqualText('same-secret', 'same-secret'), true);
  assert.equal(await secureEqualText('wrong-secret', 'same-secret'), false);
});
