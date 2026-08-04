import test from 'node:test';
import assert from 'node:assert/strict';

import { subscriptionLimitState } from '../src/index.js';

test('limited plan allows additions while capacity remains', () => {
  assert.deepEqual(subscriptionLimitState(4, 5, 1), {
    used: 4,
    limit: 5,
    remaining: 1,
    percentage: 80,
    status: 'near_limit',
    allowed: true,
  });
});

test('limited plan blocks additions at its allowance', () => {
  const state = subscriptionLimitState(5, 5, 1);
  assert.equal(state.status, 'at_limit');
  assert.equal(state.allowed, false);
  assert.equal(state.remaining, 0);
});

test('unlimited plan never blocks additions', () => {
  assert.deepEqual(subscriptionLimitState(500, null, 1), {
    used: 500,
    limit: null,
    remaining: null,
    percentage: null,
    status: 'unlimited',
    allowed: true,
  });
});

test('over-limit legacy usage is visible and remains blocked', () => {
  const state = subscriptionLimitState(17, 15, 1);
  assert.equal(state.status, 'over_limit');
  assert.equal(state.allowed, false);
  assert.equal(state.percentage, 113);
});
