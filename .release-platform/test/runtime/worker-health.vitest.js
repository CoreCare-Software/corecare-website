import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('CoreCare Platform Worker runtime', () => {
  it('serves the public health contract inside workerd', async () => {
    const response=await exports.default.fetch('https://platform.corecare.test/api/health');
    const payload=await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      ok: true,
      service: 'corecare',
      version: '1.11.0',
      database: true,
      authentication: true,
    });
  });

  it('does not expose unknown API routes without a session', async () => {
    const response=await exports.default.fetch('https://platform.corecare.test/api/private-check');
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
