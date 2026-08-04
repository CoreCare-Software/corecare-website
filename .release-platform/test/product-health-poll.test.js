import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPolledProductHealth } from '../src/index.js';

test('projects CoreCare health responses into healthy monitor states', () => {
  assert.deepEqual(projectPolledProductHealth(true, {
    ok: true,
    version: '1.5.0',
    database: true,
    authentication: true,
    managementSuite: 'configured',
  }, 42), {
    status: 'healthy',
    responseMs: 42,
    databaseStatus: 'healthy',
    authStatus: 'healthy',
    integrationStatus: 'healthy',
    version: '1.5.0',
    details: {
      source: 'platform_health_poll',
      reportedStatus: null,
      error: null,
      payload: { ok: true, version: '1.5.0', database: true, authentication: true, managementSuite: 'configured' },
    },
  });
});

test('understands Finance service health and failed HTTP responses', () => {
  const finance = projectPolledProductHealth(true, {
    ok: true,
    status: 'operational',
    services: { database: 'operational', platformAuthentication: 'configured' },
  }, 18);
  assert.equal(finance.status, 'healthy');
  assert.equal(finance.databaseStatus, 'healthy');
  assert.equal(finance.authStatus, 'healthy');

  const failed = projectPolledProductHealth(false, { status: 'unavailable' }, 15000, 'HTTP 503');
  assert.equal(failed.status, 'failed');
  assert.equal(failed.details.error, 'HTTP 503');
});
