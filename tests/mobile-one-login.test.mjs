import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile login uses fixed client, callback, PKCE and state boundaries", async () => {
  const [authorization, page, client, worker, fallback] = await Promise.all([
    read("app/mobile-login/mobile-authorization.ts"),
    read("app/mobile-login/page.tsx"),
    read("app/mobile-login/mobile-login-client.tsx"),
    read("worker/index.ts"),
    read("app/api/mobile-login/route.ts"),
  ]);

  assert.match(authorization, /uk\.co\.corecaresystems\.app/);
  assert.match(authorization, /uk\.co\.corecaresystems\.app:\/\/auth\/callback/);
  assert.match(authorization, /S256/);
  assert.match(authorization, /searchParams\.get\("state"\) === expectedState/);
  assert.match(page, /CANONICAL_LOGIN_HOST = "login\.corecaresystems\.co\.uk"/);
  assert.match(page, /STAGING_LOGIN_HOST = "corecare-website-staging\.cselectricalservices11\.workers\.dev"/);
  assert.match(page, /ALLOWED_LOGIN_HOSTS\.has\(host\)/);
  assert.match(client, /fetch\("\/api\/mobile-login"/);
  assert.match(client, /isExpectedMobileCallback/);
  assert.doesNotMatch(client, /searchParams\.set\("(?:email|password)"/);
  assert.match(worker, /authorizeMobile\(input: Record<string, unknown>\)/);
  assert.match(worker, /handleMobileLogin/);
  assert.match(worker, /verifyTurnstile\(request, input\.turnstileToken, "login"\)/);
  assert.match(worker, /allowFormRequest\(request, "mobile-login-portal", 10, 15\)/);
  assert.match(worker, /MFA_REQUIRED/);
  assert.match(worker, /validatedMobileCallback/);
  assert.doesNotMatch(worker, /console\.(?:log|info|warn|error)\([^\n]*(?:password|codeChallenge|redirectUrl)/i);
  assert.match(fallback, /requires the Cloudflare Worker runtime/);
});

test("staging mobile login keeps authorization and Turnstile on the staging Website worker", async () => {
  const config = await read("wrangler.cloudflare.jsonc");
  assert.match(
    config,
    /TURNSTILE_HOSTNAMES[^\n]+corecare-website-staging\.cselectricalservices11\.workers\.dev/,
  );
});
