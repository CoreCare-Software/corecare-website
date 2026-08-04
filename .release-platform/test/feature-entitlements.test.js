import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseFeatureKey,
  parseFeatureDependencies,
  resolveFeatureEntitlements,
  resolveProductEntitlements,
} from '../src/index.js';
import worker from '../src/index.js';

const catalogue = [
  { feature_key: 'dashboard', name: 'Dashboard', default_enabled: 1, mandatory: 1, status: 'active', dependencies_json: '[]' },
  { feature_key: 'orders', name: 'Orders', default_enabled: 1, mandatory: 0, status: 'active', dependencies_json: '[]' },
  { feature_key: 'kitchen', name: 'Kitchen', default_enabled: 1, mandatory: 0, status: 'active', dependencies_json: '["orders"]' },
];

test('feature keys and dependencies are normalised into a stable product contract', () => {
  assert.equal(normaliseFeatureKey(' Sales & Invoicing '), 'sales_invoicing');
  assert.deepEqual(parseFeatureDependencies(' Orders, Stock, orders '), ['orders', 'stock']);
  assert.deepEqual(parseFeatureDependencies('["orders","stock"]'), ['orders', 'stock']);
});

test('organisation overrides change inherited defaults without disabling mandatory modules', () => {
  const features = resolveFeatureEntitlements(catalogue, [
    { feature_key: 'dashboard', state: 'disabled' },
    { feature_key: 'orders', state: 'disabled' },
  ], { productStatus: 'live', organisationStatus: 'active', linkReady: true });

  assert.equal(features.find(feature => feature.key === 'dashboard').enabled, true);
  assert.equal(features.find(feature => feature.key === 'dashboard').source, 'mandatory');
  assert.equal(features.find(feature => feature.key === 'orders').enabled, false);
  assert.equal(features.find(feature => feature.key === 'orders').source, 'owner_disabled');
});

test('dependencies block downstream features and explain the reason', () => {
  const features = resolveFeatureEntitlements(catalogue, [
    { feature_key: 'orders', state: 'disabled' },
    { feature_key: 'kitchen', state: 'enabled' },
  ], { productStatus: 'live', organisationStatus: 'active', linkReady: true });
  const kitchen = features.find(feature => feature.key === 'kitchen');

  assert.equal(kitchen.enabled, false);
  assert.equal(kitchen.source, 'dependency');
  assert.deepEqual(kitchen.blockedBy, ['orders']);
});

test('maintenance mode safely suspends every effective entitlement', () => {
  const features = resolveFeatureEntitlements(catalogue, [], {
    productStatus: 'live',
    maintenanceMode: 1,
    organisationStatus: 'active',
    linkReady: true,
  });

  assert.ok(features.every(feature => feature.enabled === false));
  assert.ok(features.every(feature => feature.source === 'product_unavailable'));
});

test('the product entitlement endpoint rejects an invalid product credential before database access', async () => {
  const database = { prepare() { throw new Error('Database should not be queried'); } };
  const request = new Request('https://platform.corecare.example/api/platform/entitlements?product_code=POS&organisation_id=org-1', {
    headers: { 'x-corecare-product-key': 'wrong-key' },
  });
  const response = await resolveProductEntitlements(request, { DB: database, CORECARE_POS_PRODUCT_KEY: 'correct-key' });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, 'INVALID_PRODUCT_CREDENTIALS');
});

test('the documented product entitlement route bypasses the human sign-in gate', async () => {
  const database = { prepare() { throw new Error('Database should not be queried'); } };
  const request = new Request('https://platform.corecare.example/api/platform/organisations/org-1/products/POS/entitlements', {
    headers: { 'x-corecare-product-key': 'wrong-key' },
  });
  const response = await worker.fetch(request, { DB: database, CORECARE_POS_PRODUCT_KEY: 'correct-key' });
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.error.code, 'INVALID_PRODUCT_CREDENTIALS');
});
