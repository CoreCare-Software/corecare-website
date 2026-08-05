import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('publishes the CoreCare compliance library and tracked rights route', async () => {
  const [company,privacy,dpa,terms,retention,rights,security,subprocessors,route,migration] = await Promise.all([
    source('app/company-details.ts'),source('app/privacy/page.tsx'),source('app/data-processing-agreement/page.tsx'),source('app/customer-terms/page.tsx'),source('app/data-retention/page.tsx'),source('app/data-rights/page.tsx'),source('app/security/page.tsx'),source('app/subprocessors/page.tsx'),source('app/api/privacy/requests/route.ts'),source('drizzle/0003_privacy_rights.sql')
  ]);
  assert.match(company,/icoRegistrationNumber: "C1999522"/);assert.match(privacy,/controller/);assert.match(privacy,/lawful bases/);assert.match(dpa,/Documented instructions/);assert.match(dpa,/Subprocessors/);assert.match(terms,/business-to-business/);assert.match(retention,/legal hold/i);assert.match(rights,/one calendar month/i);assert.match(security,/72 hours/);assert.match(subprocessors,/Cloudflare/);
  assert.match(route,/allowFormRequest/);assert.match(route,/identityStatus: "not_checked"/);assert.doesNotMatch(route,/identityDocument|passport|drivingLicence/);assert.match(migration,/idx_privacy_requests_status_due/);
});
