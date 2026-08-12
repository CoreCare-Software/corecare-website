import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('staging login stays on the staging Website and permits Turnstile there', async () => {
  const [page, config] = await Promise.all([
    readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../wrangler.cloudflare.jsonc', import.meta.url), 'utf8'),
  ]);
  assert.match(page, /corecare-website-staging\.cselectricalservices11\.workers\.dev/);
  assert.match(page, /LOGIN_HOSTS\.has\(host\)/);
  assert.match(config, /TURNSTILE_HOSTNAMES[^\n]+corecare-website-staging\.cselectricalservices11\.workers\.dev/);
});

test('staging handoff client blocks production and unknown product targets', async () => {
  const source = await readFile(new URL('../app/login/login-client.tsx', import.meta.url), 'utf8');
  assert.match(source, /STAGING_PRODUCT_HOST/);
  assert.match(source, /stagingLogin \? !stagingTarget : !productionTarget/);
  assert.match(source, /blocked a handoff outside staging/);
});

test('identity and mapping failures have controlled user-facing messages', async () => {
  const source = await readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
  for (const code of [
    'identity_contract_failed',
    'tenant_mapping_invalid',
    'user_mapping_missing',
    'user_identity_mismatch',
    'role_mapping_invalid',
  ]) {
    assert.match(source, new RegExp(`${code}:`));
  }
});
