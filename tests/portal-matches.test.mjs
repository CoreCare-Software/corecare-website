import test from 'node:test';
import assert from 'node:assert/strict';
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
      { code: 'CARE', name: 'CoreCare Care', action: 'https://care.example/auth', grant: 'care-grant' },
      { code: 'MARKETING', name: 'CoreCare Marketing', reason: 'MARKETING_NOT_IN_ONE_LOGIN' },
    ],
  });
  assert.deepEqual(result.ready.map(item => item.code), ['CARE']);
  assert.deepEqual(result.unavailable.map(item => item.code), ['MARKETING']);
});
