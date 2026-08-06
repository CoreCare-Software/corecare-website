import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public capability tokens are opaque, hashed, encrypted where required, and expiring", async () => {
  const [tokens, trialCapabilities, contactCapabilities, schema, migration, trialRoute, contactRoute, privacyRoute] = await Promise.all([
    source("db/capability-tokens.ts"),
    source("db/trial-capabilities.ts"),
    source("db/contact-capabilities.ts"),
    source("db/schema.ts"),
    source("drizzle/0004_secure_capability_tokens.sql"),
    source("app/api/trials/route.ts"),
    source("app/api/contact/route.ts"),
    source("app/api/privacy/requests/route.ts"),
  ]);

  assert.match(tokens, /crypto\.getRandomValues/);
  assert.match(tokens, /SHA-256/);
  assert.match(tokens, /AES-GCM/);
  assert.match(tokens, /WEBSITE_TOKEN_ENCRYPTION_KEY/);
  assert.match(schema, /access_token_hash/);
  assert.match(schema, /access_token_expires_at/);
  assert.match(schema, /automation_token_ciphertext/);
  assert.match(schema, /automation_token_expires_at/);
  assert.match(migration, /idx_trial_requests_access_token_hash/);
  assert.match(migration, /idx_contact_requests_automation_token_hash/);
  assert.match(trialCapabilities, /hashCapabilityToken/);
  assert.match(contactCapabilities, /hashCapabilityToken/);
  assert.match(trialRoute, /accessTokenHash/);
  assert.match(contactRoute, /automationTokenHash/);
  assert.doesNotMatch(privacyRoute, /automationToken:\s*automationToken/);
});

test("the public website has its own D1 database and no public token-verification endpoint", async () => {
  const config = await source("wrangler.cloudflare.jsonc");
  assert.match(config, /"database_name": "corecare-website"/);
  assert.match(config, /"database_name": "corecare-website-staging"/);
  assert.doesNotMatch(config, /corecare-platform-d1|91efdc88-26d1-4c6a-9b8e-0e91649f27fa/);
  await assert.rejects(access(new URL("../app/api/privacy/requests/verify/route.ts", import.meta.url)));
});
