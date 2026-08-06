import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all public forms use explicit same-origin POST fallbacks", async () => {
  const [login, trial, contact, help, rights, status, body, worker] = await Promise.all([
    source("app/login/login-client.tsx"),
    source("app/trial/trial-client.tsx"),
    source("app/contact/contact-client.tsx"),
    source("app/account-help/account-help-client.tsx"),
    source("app/data-rights/data-rights-client.tsx"),
    source("app/trial/status/status-client.tsx"),
    source("app/api/_shared/body.ts"),
    source("worker/index.ts"),
  ]);

  for (const [form, action] of [
    [login, "/api/login"],
    [trial, "/api/trials"],
    [contact, "/api/contact"],
    [help, "/api/contact"],
    [rights, "/api/privacy/requests"],
    [status, "/api/trials/password"],
  ]) {
    assert.match(form, /method="post"/);
    assert.match(form, new RegExp(`action="${action}"`));
  }

  assert.match(help, /TurnstileWidget/);
  assert.match(help, /turnstileToken/);
  assert.match(body, /application\\\/x-www-form-urlencoded/);
  assert.match(body, /cf-turnstile-response/);
  assert.match(worker, /FORM_QUERY_FIELDS/);
  assert.match(worker, /request\.method === "GET"/);
  assert.match(worker, /Form details must be submitted securely using POST/);
});

test("uses nonce-authorised scripts and routes hashed assets through the Worker", async () => {
  const [worker, wrangler, vite] = await Promise.all([
    source("worker/index.ts"),
    source("wrangler.cloudflare.jsonc"),
    source("vite.config.ts"),
  ]);
  const scriptDirective = worker.split("\n").find((line) => line.includes("script-src ")) || "";

  assert.doesNotMatch(scriptDirective, /unsafe-inline/);
  assert.match(scriptDirective, /nonce-/);
  assert.match(worker, /script-src-attr 'none'/);
  assert.match(worker, /new HTMLRewriter\(\)/);
  assert.match(worker, /element\.setAttribute\("nonce", nonce\)/);
  assert.match(wrangler, /"run_worker_first"/);
  assert.match(vite, /run_worker_first/);
});

test("ships the accessibility, mobile, prefetch and social-preview corrections", async () => {
  const [styles, products, chrome, home, productPage, demosPage, demosClient] = await Promise.all([
    source("app/audit-remediations.css"),
    source("app/products.ts"),
    source("app/site-chrome.tsx"),
    source("app/home-client.tsx"),
    source("app/products/[slug]/page.tsx"),
    source("app/demos/page.tsx"),
    source("app/demos/demo-client.tsx"),
  ]);

  assert.match(styles, /#63706d/);
  assert.match(styles, /#66cabc/);
  assert.match(styles, /max-width: 420px/);
  assert.match(styles, /header-trial-short/);
  assert.match(products, /accent: "#8f451f"/);
  assert.ok([...chrome.matchAll(/prefetch=\{false\}/g)].length >= 9);
  assert.match(home, /href="\/trial" prefetch=\{false\}/);
  assert.match(productPage, /images: \[SUITE_SOCIAL_IMAGE\]/);
  assert.match(demosPage, /images: \["\/og\.png"\]/);
  assert.match(demosClient, /aria-label="Representative notifications"/);
  assert.match(demosClient, /More options for/);
});
