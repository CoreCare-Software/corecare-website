import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Website transports Mobile PKCE without returning credentials to the app', async () => {
  const [worker, page, client, webClient] = await Promise.all([
    readFile(new URL('../worker/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/mobile-login/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/mobile-login/mobile-login-client.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/login/login-client.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(worker, /\/api\/mobile-token/);
  assert.match(worker, /\/api\/mobile-select/);
  assert.match(worker, /\/api\/mobile-products/);
  assert.match(worker, /\/api\/mobile-leave/);
  assert.match(worker, /\/api\/mobile-logout/);
  assert.match(worker, /verifyMobileMfa/);
  assert.match(worker, /\/api\/mobile-login\/mfa/);
  assert.match(worker, /completeMobilePasswordSetup/);
  assert.match(worker, /\/api\/mobile-login\/password/);
  assert.doesNotMatch(worker, /requestedProduct: "CARE"/);
  assert.doesNotMatch(worker, /if \(!origin && request\.headers\.get\("x-corecare-mobile-client"\)/);
  assert.match(worker, /"capacitor:\/\/localhost", "https:\/\/localhost"/);
  assert.match(worker, /capacitor:\/\/localhost/);
  assert.match(page, /parseMobileAuthorizationSearch/);
  assert.match(client, /window\.location\.assign\(result\.redirectUrl\)/);
  assert.match(client, /"\/api\/mobile-login\/mfa"/);
  assert.match(client, /"\/api\/mobile-login\/password"/);
  assert.match(client, /Platform owns authentication and MFA/);
  assert.doesNotMatch(client, /productCode/);
  assert.doesNotMatch(client, /Object\.entries\(\{ email, password/);
  assert.doesNotMatch(webClient, /\/api\/mobile-login\/mfa|\/api\/mobile-login\/password/);
});

test('Website preserves every Platform product result without a Marketing exception', async () => {
  const source = await readFile(new URL('../worker/portal-matches.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.filter\([^\n]*MARKETING|MARKETING[^\n]*\.filter\(/);
  assert.match(source, /unavailable/);
});
