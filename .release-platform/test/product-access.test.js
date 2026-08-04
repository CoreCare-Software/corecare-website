import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductLaunchUrl,
  productAccessKey,
  createPlatformSupportSession,
  exchangePlatformAccess,
  resolveProductOrganisationHealth,
} from '../src/index.js';

const platformSession = {
  session_id: 'browser-session-1',
  user_id: 'platform-user-1',
  organisation_id: 'platform-org',
  access_level: 'platform_owner',
  is_platform_user: 1,
  support_mode: 0,
};

test('product launch URLs use the standard receiver and preserve the Platform origin', () => {
  const result = new URL(buildProductLaunchUrl('https://pos.corecare.example/app', 'single-use-code', 'https://platform.corecare.example'));

  assert.equal(result.origin, 'https://pos.corecare.example');
  assert.equal(result.pathname, '/platform-access');
  assert.equal(result.searchParams.get('code'), 'single-use-code');
  assert.equal(result.searchParams.get('platform_origin'), 'https://platform.corecare.example');
});

test('product keys can be configured directly or through the JSON registry', () => {
  assert.equal(productAccessKey({ CORECARE_POS_PRODUCT_KEY: 'pos-secret' }, 'pos'), 'pos-secret');
  assert.equal(productAccessKey({ CORECARE_PRODUCT_KEYS: JSON.stringify({ FINANCE: 'finance-secret' }) }, 'FINANCE'), 'finance-secret');
  assert.equal(productAccessKey({}, 'CARE'), '');
});

test('a successful organisation refresh clears a previously stored product error immediately', () => {
  const health = resolveProductOrganisationHealth({ integration_status: 'failed', last_sync_error: 'CoreCare Care returned HTTP 500.' }, '', true);
  assert.equal(health.integration_status, 'connected');
  assert.equal(health.last_sync_error, null);
});

test('starting product access validates the link and returns a single-use launch', async () => {
  const batches = [];
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.includes('FROM platform_products p JOIN platform_product_organisations')) {
            return {
              first: async () => ({
                id: 'product-pos',
                code: 'POS',
                name: 'CoreCare POS',
                status: 'live',
                production_url: 'https://pos.corecare.example',
                organisation_name: 'Example Hospitality',
                organisation_status: 'active',
                external_organisation_id: 'tenant-pos-1',
                access_status: 'ready',
              }),
            };
          }
          if (sql.includes('FROM platform_settings')) {
            return {
              first: async () => ({
                setting_value: JSON.stringify({ defaultSupportDurationMinutes: 30, maximumSupportDurationMinutes: 30 }),
                updated_at: '2026-08-03 12:00:00',
                updated_by_name: 'Platform Owner',
              }),
            };
          }
          return { sql, values };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
  const request = new Request('https://platform.corecare.example/api/platform/support-sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      product_id: 'product-pos',
      organisation_id: 'org-1',
      access_mode: 'support',
      duration_minutes: 60,
      reason: 'Investigate a reported till issue',
    }),
  });

  const response = await createPlatformSupportSession(request, { DB: database }, platformSession);
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.equal(payload.product.code, 'POS');
  assert.equal(payload.organisation.external_id, 'tenant-pos-1');
  assert.equal(new URL(payload.launch_url).pathname, '/platform-access');
  assert.equal(new URL(payload.launch_url).searchParams.get('platform_origin'), 'https://platform.corecare.example');
  assert.ok(new URL(payload.launch_url).searchParams.get('code'));
  assert.equal(payload.expires_in_minutes, 30);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 3);
  assert.equal(batches[0][0].values[6], '+30 minutes');
});

test('monitoring-only organisation rows cannot start product support access', async () => {
  const database = {
    prepare(sql) {
      return {
        bind() {
          if (sql.includes('FROM platform_products p JOIN platform_product_organisations')) {
            return {
              first: async () => ({
                id: 'product-campsite',
                code: 'CAMPSITE',
                name: 'CoreCare Campsite',
                status: 'live',
                production_url: 'https://campsite.corecare.example',
                organisation_name: 'Example Campsite',
                organisation_status: 'active',
                external_organisation_id: null,
                access_status: 'pending',
              }),
            };
          }
          return { first: async () => null };
        },
      };
    },
    batch: async () => assert.fail('No access grant should be written for a pending mapping.'),
  };
  const request = new Request('https://platform.corecare.example/api/platform/support-sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      product_id: 'product-campsite',
      organisation_id: 'org-1',
      access_mode: 'support',
      reason: 'Investigate a reported booking issue',
    }),
  });

  const response = await createPlatformSupportSession(request, { DB: database }, platformSession);
  const payload = await response.json();
  assert.equal(response.status, 409);
  assert.equal(payload.error.code, 'PRODUCT_ORGANISATION_NOT_READY');
});

test('a product cannot exchange a grant with the wrong product key', async () => {
  const response = await exchangePlatformAccess(new Request('https://platform.corecare.example/api/platform/access/exchange', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-corecare-product-key': 'wrong-key',
    },
    body: JSON.stringify({ code: 'grant-code', product_code: 'POS' }),
  }), {
    DB: { prepare: () => assert.fail('The database must not be queried for invalid product credentials.') },
    CORECARE_POS_PRODUCT_KEY: 'correct-key',
  });

  assert.equal(response.status, 401);
});
