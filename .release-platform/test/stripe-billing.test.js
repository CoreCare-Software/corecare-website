import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker, { stripeCoreCareStatus, verifyStripeSignature } from '../src/index.js';

async function webhookSignature(payload, secret, timestamp) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

test('Stripe subscription states map to CoreCare enforcement states', () => {
  assert.equal(stripeCoreCareStatus('active'), 'active');
  assert.equal(stripeCoreCareStatus('trialing'), 'trial');
  assert.equal(stripeCoreCareStatus('past_due'), 'past_due');
  assert.equal(stripeCoreCareStatus('unpaid'), 'past_due');
  assert.equal(stripeCoreCareStatus('canceled'), 'cancelled');
  assert.equal(stripeCoreCareStatus('incomplete_expired'), 'cancelled');
});

test('Stripe webhook signatures require the raw body and a recent timestamp', async () => {
  const secret = 'whsec_corecare_test_secret';
  const payload = JSON.stringify({ id: 'evt_corecare', type: 'customer.subscription.updated' });
  const timestamp = 1_786_000_000;
  const signature = await webhookSignature(payload, secret, timestamp);
  const header = `t=${timestamp},v1=${signature}`;

  assert.equal(await verifyStripeSignature(payload, header, secret, timestamp * 1000), true);
  assert.equal(await verifyStripeSignature(`${payload} `, header, secret, timestamp * 1000), false);
  assert.equal(await verifyStripeSignature(payload, header, secret, (timestamp + 301) * 1000), false);
});

test('Stripe webhook reports missing configuration without an uncaught Worker error', async () => {
  const request = new Request('https://platform.example/api/billing/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const response = await worker.fetch(request, { DB: {} });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'STRIPE_WEBHOOK_NOT_CONFIGURED',
      message: 'The Stripe webhook secret is not configured.',
    },
  });
});

test('billing integration keeps secrets server-side and exposes safe owner controls', async () => {
  const [worker, app, migration] = await Promise.all([
    readFile(new URL('../src/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../migrations/0051_stripe_billing.sql', import.meta.url), 'utf8'),
  ]);

  assert.match(worker, /\/api\/billing\/stripe\/webhook/);
  assert.match(worker, /request\.text\(\)/);
  assert.match(worker, /stripe-signature/);
  assert.match(worker, /STRIPE_SECRET_KEY/);
  assert.doesNotMatch(app, /sk_(?:test|live)_/);
  assert.doesNotMatch(app, /whsec_/);
  assert.match(app, /Open secure Stripe Checkout/);
  assert.match(app, /Open billing portal/);
  assert.match(migration, /stripe_webhook_events/);
  assert.match(migration, /stripe_customer_id/);
});
