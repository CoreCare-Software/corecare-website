import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlatformTicketAttachment,
  getPlatformTicketAttachment,
  deletePlatformTicketAttachment,
} from '../src/index.js';

const organisationSession = {
  user_id: 'user-1',
  organisation_id: 'org-1',
  access_level: 'organisation_admin',
  is_platform_user: 0,
  support_mode: 0,
};

const platformSession = {
  ...organisationSession,
  access_level: 'platform_admin',
  is_platform_user: 1,
};

function databaseThatMustNotBeUsed() {
  return {
    prepare() {
      assert.fail('Database access must not occur before platform authorisation.');
    },
  };
}

test('attachment operations reject non-platform users before database access', async () => {
  const database = databaseThatMustNotBeUsed();
  const request = new Request('https://corecare.test/attachment', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  for (const response of [
    await addPlatformTicketAttachment(request, database, organisationSession, 'ticket-1'),
    await getPlatformTicketAttachment(database, organisationSession, 'attachment-1'),
    await deletePlatformTicketAttachment(database, organisationSession, 'attachment-1'),
  ]) {
    assert.equal(response.status, 403);
  }
});

test('attachment upload accepts the browser snake_case payload', async () => {
  const calls = [];
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          calls.push({ sql, values });
          return {
            first: async () => ({ id: 'ticket-1' }),
            run: async () => ({ success: true }),
          };
        },
      };
    },
  };
  const request = new Request('https://corecare.test/attachment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      file_name: 'evidence.txt',
      mime_type: 'text/plain',
      size_bytes: 5,
      data_url: 'data:text/plain;base64,aGVsbG8=',
    }),
  });

  const response = await addPlatformTicketAttachment(request, database, platformSession, 'ticket-1');

  assert.equal(response.status, 201);
  assert.equal(calls.length, 3);
  assert.equal(calls[1].values[2], 'evidence.txt');
  assert.equal(calls[1].values[3], 'text/plain');
  assert.equal(calls[1].values[5], 'data:text/plain;base64,aGVsbG8=');
  assert.match(calls[2].sql, /audit_log/);
});

test('attachment download decodes a stored data URL', async () => {
  const database = {
    prepare() {
      return {
        bind() {
          return {
            first: async () => ({
              file_name: 'evidence.txt',
              mime_type: 'text/plain',
              data_url: 'data:text/plain;base64,aGVsbG8=',
            }),
          };
        },
      };
    },
  };

  const response = await getPlatformTicketAttachment(database, platformSession, 'attachment-1');

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'hello');
  assert.equal(response.headers.get('content-type'), 'text/plain');
  assert.match(response.headers.get('content-disposition'), /evidence\.txt/);
});
