import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Website transports Mobile PKCE without returning credentials to the app', async () => {
  const [worker, page, client] = await Promise.all([
    readFile(new URL('../worker/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/login/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/login/login-client.tsx', import.meta.url), 'utf8'),
  ]);
  assert.match(worker, /\/api\/mobile-token/);
  assert.match(worker, /\/api\/mobile-select/);
  assert.match(worker, /requestedProduct: "CARE"/);
  assert.match(worker, /capacitor:\/\/localhost/);
  assert.match(page, /codeChallenge/);
  assert.match(client, /window\.location\.assign\(result\.redirectUrl\)/);
  assert.doesNotMatch(client, /Object\.entries\(\{ email, password/);
});

test('Website preserves every Platform product result without a Marketing exception', async () => {
  const source = await readFile(new URL('../worker/portal-matches.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.filter\([^\n]*MARKETING|MARKETING[^\n]*\.filter\(/);
  assert.match(source, /unavailable/);
});
