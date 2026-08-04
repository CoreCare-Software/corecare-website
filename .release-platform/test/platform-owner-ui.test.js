import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the owner command centre exposes a clear second-owner path', async () => {
  const [html, app] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /Platform owners &amp; staff/);
  assert.match(html, /id="platform-open-owners"/);
  assert.match(html, /Add a second owner for account recovery/);
  assert.match(app, /data-add-platform-owner/);
  assert.match(app, /Only a signed-in Platform owner can add or change Platform personnel/);
});
