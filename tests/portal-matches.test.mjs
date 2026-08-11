import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalisePortalMatches } from '../worker/portal-matches.js';

test('does not silently remove Marketing from Platform matches', () => {
  const result = normalisePortalMatches({
    matches: [{
      code: 'MARKETING',
      name: 'CoreCare Marketing',
      description: 'Marketing workspace',
      action: '',
      grant: '',
      reason: 'MARKETING_NOT_IN_ONE_LOGIN',
    }],
  });
  assert.deepEqual(result.ready, []);
  assert.equal(result.unavailable.length, 1);
  assert.equal(result.unavailable[0].code, 'MARKETING');
  assert.equal(result.unavailable[0].reason, 'MARKETING_NOT_IN_ONE_LOGIN');
});

test('includes Marketing automatically once Platform supplies a valid handoff', () => {
  const result = normalisePortalMatches({
    matches: [{
      code: 'MARKETING',
      name: 'CoreCare Marketing',
      action: 'https://marketing.corecaresystems.co.uk/auth/portal-login',
      grant: 'single-use-grant',
      returnTo: '/',
    }],
  });
  assert.equal(result.unavailable.length, 0);
  assert.equal(result.ready.length, 1);
  assert.equal(result.ready[0].productCode, 'MARKETING');
});

test('keeps ready and not-yet-ready products distinct for multi-product users', () => {
  const result = normalisePortalMatches({
    matches: [
      { code: 'CARE', name: 'CoreCare Care', action: 'https://care.corecaresystems.co.uk/auth/portal-login', grant: 'care-grant' },
      { code: 'MARKETING', name: 'CoreCare Marketing', reason: 'MARKETING_NOT_IN_ONE_LOGIN' },
    ],
  });
  assert.deepEqual(result.ready.map(item => item.code), ['CARE']);
  assert.deepEqual(result.unavailable.map(item => item.code), ['MARKETING']);
});

test('accepts only exact product targets for the Website environment', () => {
  const stagingAction = 'https://corecare-care-staging.cselectricalservices11.workers.dev/auth/portal-login';
  const staging = normalisePortalMatches({
    matches: [{ code: 'CARE', name: 'CoreCare Care', action: stagingAction, grant: 'care-grant' }],
  }, 'staging');
  assert.equal(staging.ready.length, 1);
  assert.equal(staging.ready[0].handoffUrl, stagingAction);

  const crossEnvironment = normalisePortalMatches({
    matches: [{
      code: 'CARE',
      name: 'CoreCare Care',
      action: 'https://care.corecaresystems.co.uk/auth/portal-login',
      grant: 'care-grant',
    }],
  }, 'staging');
  assert.equal(crossEnvironment.ready.length, 0);
  assert.equal(crossEnvironment.unavailable[0].reason, 'HANDOFF_TARGET_INVALID');

  const arbitrary = normalisePortalMatches({
    matches: [{ code: 'CARE', name: 'CoreCare Care', action: 'https://example.test/collect', grant: 'care-grant' }],
  });
  assert.equal(arbitrary.ready.length, 0);
  assert.equal(arbitrary.unavailable[0].reason, 'HANDOFF_TARGET_INVALID');
});

test('the client does not auto-redirect past an unavailable assigned product', async () => {
  const source = await readFile(new URL('../app/login/login-client.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(result\.handoff\) \{\s*if \(unavailable\.length\)/s);
  assert.match(source, /Assigned products awaiting secure One Login/);
  assert.match(source, /setUnavailableProducts\(unavailable\)/);
});
