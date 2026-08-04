import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestProductTicket } from '../src/index.js';

function databaseFixture() {
  const inserts = [];
  return {
    inserts,
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.includes('FROM platform_products WHERE code=')) return { first: async () => ({ id: 'product-campsite' }) };
          if (sql.includes('FROM platform_product_organisations')) return { first: async () => ({ organisation_id: 'org-1' }) };
          if (sql.includes('FROM platform_support_tickets WHERE source_product=')) return { first: async () => null };
          if (sql.includes('INSERT INTO platform_support_tickets')) return { run: async () => { inserts.push(values); return { success: true }; } };
          return { first: async () => null };
        },
      };
    },
  };
}

test('connected products can submit tickets into the central queue', async () => {
  const database = databaseFixture();
  const response = await ingestProductTicket(new Request('https://platform.example/api/platform/product-tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-corecare-product-key': 'campsite-secret' },
    body: JSON.stringify({
      id: 'local-ticket-1', product_code: 'CAMPSITE', organisation_id: 'org-1',
      subject: 'Booking screen unavailable', description: 'The booking screen does not open.',
      priority: 'urgent', category: 'technical', version: '1.0.0',
      contact: { name: 'Site Manager', email: 'manager@example.test' },
    }),
  }), { DB: database, CORECARE_CAMPSITE_PRODUCT_KEY: 'campsite-secret' });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.match(body.ticketNumber, /^CC-/);
  assert.equal(database.inserts.length, 1);
  assert.ok(database.inserts[0].includes('critical'));
  assert.ok(database.inserts[0].includes('local-ticket-1'));
});

test('product ticket ingestion rejects an invalid product credential', async () => {
  const response = await ingestProductTicket(new Request('https://platform.example/api/platform/product-tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-corecare-product-key': 'wrong-secret' },
    body: JSON.stringify({ product_code: 'CAMPSITE', organisation_id: 'org-1', subject: 'Help' }),
  }), { DB: databaseFixture(), CORECARE_CAMPSITE_PRODUCT_KEY: 'correct-secret' });
  assert.equal(response.status, 401);
});
