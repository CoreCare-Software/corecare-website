import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [worker, client] = await Promise.all([
  readFile(new URL('../worker/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../app/login/login-client.tsx', import.meta.url), 'utf8'),
]);

test('the canonical Website redeems one-use switch tickets before showing products', () => {
  assert.match(worker, /url\.pathname === "\/api\/login\/switch"/u);
  assert.match(worker, /validSameOriginRequest\(request\)/u);
  assert.match(worker, /CORECARE_PLATFORM_PORTAL\.redeemProductChooser/u);
  assert.match(worker, /portalResult\(payload, status, websiteEnvironment\(request\), true\)/u);
  assert.match(client, /new URLSearchParams\(window\.location\.hash\.slice\(1\)\)/u);
  assert.match(client, /chooserTicket\.current = fragment\.get\("switch"\)/u);
  assert.match(client, /window\.history\.replaceState/u);
  assert.match(client, /request\("\/api\/login\/switch", \{ ticket \}\)/u);
});

test('chooser handoffs use only explicit destination URLs and no wildcard product origin', () => {
  for (const code of ['CARE', 'CAMPSITE', 'FINANCE', 'GARAGE', 'MARKETING', 'POS']) {
    assert.match(client, new RegExp(`${code}: "https://`));
  }
  assert.match(client, /action\.toString\(\) !== expectedTarget/u);
  assert.doesNotMatch(client, /endsWith\("\.corecaresystems\.co\.uk"\)/u);
  assert.doesNotMatch(worker, /https:\/\/\*\.corecaresystems\.co\.uk/u);
});
