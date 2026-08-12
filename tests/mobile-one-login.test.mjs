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
  assert.match(worker, /verifyTurnstileDetailed\(request, input\.turnstileToken, "login"\)/);
  assert.match(worker, /allowFormRequest\(request, "mobile-login-portal", 10, 15\)/);
  assert.match(worker, /MFA_REQUIRED/);
  assert.match(worker, /validatedMobileCallback/);
  assert.doesNotMatch(worker, /console\.(?:log|info|warn|error)\([^\n]*(?:password|codeChallenge|redirectUrl)/i);
  assert.match(fallback, /requires the Cloudflare Worker runtime/);
});

test("mobile login retains exactly the active Turnstile response and blocks early submission", async () => {
  const [client, widget] = await Promise.all([
    read("app/mobile-login/mobile-login-client.tsx"),
    read("app/turnstile-widget.tsx"),
  ]);

  assert.match(client, /const turnstileToken = useRef\(""\)/);
  assert.match(client, /const activeTurnstileToken = turnstileToken\.current/);
  assert.match(client, /turnstileToken: activeTurnstileToken/);
  assert.match(client, /disabled=!authorization \|\| busy \|\| !turnstileReady|disabled=\{!authorization \|\| busy \|\| !turnstileReady\}/);
  assert.match(client, /turnstileToken\.current = ""/);
  assert.match(client, /response\.headers\.get\("x-request-id"\)/);

  assert.match(widget, /"expired-callback": \(\) => clear\("expired"\)/);
  assert.match(widget, /"timeout-callback": \(\) => clear\("timeout"\)/);
  assert.match(widget, /"error-callback": \(\) =>/);
  assert.match(widget, /return true/);
});

test("server-side Turnstile verification is fail-closed, correlated and proxy-safe", async () => {
  const [turnstile, worker] = await Promise.all([
    read("app/api/_shared/turnstile.ts"),
    read("worker/index.ts"),
  ]);

  assert.match(turnstile, /idempotency_key: crypto\.randomUUID\(\)/);
  assert.doesNotMatch(turnstile, /remoteip/);
  assert.match(turnstile, /timeout-or-duplicate/);
  assert.match(turnstile, /invalid-input-secret/);
  assert.match(turnstile, /SECURITY_VERIFICATION_UNAVAILABLE/);
  assert.match(turnstile, /SECURITY_VERIFICATION_EXPIRED/);
  assert.match(turnstile, /x-request-id/);

  assert.match(worker, /mobile_login_turnstile/);
  assert.match(worker, /outcome: turnstile\.reason/);
  assert.match(worker, /turnstileRejected\(turnstile, requestId\)/);
  assert.match(worker, /x-request-id/);
});

test("staging mobile login keeps authorization and Turnstile on the staging Website worker", async () => {
  const config = await read("wrangler.cloudflare.jsonc");
  assert.match(
    config,
    /TURNSTILE_HOSTNAMES[^\n]+corecare-website-staging\.cselectricalservices11\.workers\.dev/,
  );
});
