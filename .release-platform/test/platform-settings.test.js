import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLATFORM_SETTINGS,
  normalisePlatformSettings,
  platformAuditCategoryClause,
  getPlatformSettings,
  updatePlatformSettings,
} from '../src/index.js';

const ownerSession = {
  user_id: 'platform-owner-1',
  organisation_id: 'platform-org',
  access_level: 'platform_owner',
  is_platform_user: 1,
  support_mode: 0,
};

test('platform settings use safe defaults and enforce dependent limits', () => {
  assert.deepEqual(normalisePlatformSettings({}), DEFAULT_PLATFORM_SETTINGS);
  assert.deepEqual(normalisePlatformSettings({
    defaultSupportDurationMinutes: 120,
    maximumSupportDurationMinutes: 30,
    warningErrorThreshold: 20,
    criticalErrorThreshold: 5,
    activeSupportWarningThreshold: 0,
    auditPageSize: 999,
  }), {
    defaultSupportDurationMinutes: 120,
    maximumSupportDurationMinutes: 120,
    warningErrorThreshold: 20,
    criticalErrorThreshold: 20,
    activeSupportWarningThreshold: 1,
    auditPageSize: 250,
    healthRetentionDays: 90,
    auditCheckpointHours: 24,
  });
});

test('audit categories are mapped to fixed server-side clauses', () => {
  assert.match(platformAuditCategoryClause('support'), /support/);
  assert.match(platformAuditCategoryClause('authentication'), /user/);
  assert.equal(platformAuditCategoryClause('anything-else'), '');
});

function settingsDatabase(initialValue = null) {
  let stored = initialValue;
  const batches = [];
  return {
    get stored() { return stored; },
    batches,
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.includes('FROM platform_settings ps')) {
            return { first: async () => stored ? ({ setting_value: stored, updated_at: '2026-08-03 12:00:00', updated_by_name: 'Platform Owner' }) : null };
          }
          return { sql, values };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      const settingStatement = statements.find(statement => statement.sql?.includes('INSERT INTO platform_settings'));
      if (settingStatement) stored = settingStatement.values[1];
      return statements.map(() => ({ success: true }));
    },
  };
}

test('platform owner can save settings and the change is audited', async () => {
  const database = settingsDatabase();
  const response = await updatePlatformSettings(new Request('https://platform.corecare.example/api/platform/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      defaultSupportDurationMinutes: 30,
      maximumSupportDurationMinutes: 120,
      warningErrorThreshold: 2,
      criticalErrorThreshold: 8,
      activeSupportWarningThreshold: 3,
      auditPageSize: 50,
    }),
  }), database, ownerSession);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.settings.auditPageSize, 50);
  assert.equal(JSON.parse(database.stored).criticalErrorThreshold, 8);
  assert.equal(database.batches.length, 1);
  assert.equal(database.batches[0].length, 2);
  assert.match(database.batches[0][1].sql, /audit_log/);
});

test('platform settings GET returns active defaults before the first save', async () => {
  const response = await getPlatformSettings(settingsDatabase(), ownerSession);
  const payload = await response.json();
  assert.deepEqual(payload.settings, DEFAULT_PLATFORM_SETTINGS);
  assert.equal(payload.canEdit, true);
  assert.equal(payload.updatedAt, null);
});
