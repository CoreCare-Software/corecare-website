import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships the CoreCare showcase and product suite", async () => {
  const [home, products, styles] = await Promise.all([
    readFile(new URL("../app/home-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/products.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(home, /One front door/);
  for (const name of ["CoreCare Care", "CoreCare Campsites", "CoreCare Finance", "CoreCare Garage", "CoreCare POS"]) assert.match(products, new RegExp(name));
  assert.doesNotMatch(products, /Owner Platform|PLATFORM/);
  assert.match(styles, /@media\(max-width:760px\)/);
});

test("publishes precise commercial, maturity and trust information", async () => {
  const [plans, products, requirements, productPage, legal, about, status, solutions, sitemap, subprocessors] = await Promise.all([
    readFile(new URL("../app/plans/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/products.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/product-requirements.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/products/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/legal/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/about/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/status/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/solutions-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/subprocessors/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(plans, /Up to 5 active product users/);
  assert.match(plans, /50 GB hosted storage/);
  assert.match(plans, /No VAT is currently added/);
  assert.match(plans, /What “Unlimited” does and does not mean/);
  assert.match(products, /availability: "Guided evaluation"/);
  assert.match(requirements, /Not currently offered/);
  assert.match(productPage, /Current capability matrix/);
  assert.match(legal, /CONTRACTING_NAME/);
  assert.match(about, /Christopher|CONTRACTING_NAME/);
  assert.match(status, /api\/health/);
  assert.match(solutions, /domiciliary-care-management-software/);
  assert.match(sitemap, /SOLUTIONS/);
  assert.match(subprocessors, /Stripe Payments Europe/);
});

test("includes interactive visual workflows for every CoreCare product", async () => {
  const [page, client, demos, navigation, sitemap] = await Promise.all([
    readFile(new URL("../app/demos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/demos/demo-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/demos/demo-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/site-chrome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /See every customer product in action/);
  assert.match(client, /role="tabpanel"/);
  assert.match(client, /Representative demonstration/);
  for (const code of ["CARE", "CAMPSITE", "FINANCE", "GARAGE", "POS"]) assert.match(demos, new RegExp(`${code}:`));
  assert.doesNotMatch(`${page}\n${client}\n${demos}`, /Owner Platform|private owner|owner command|PLATFORM/);
  assert.match(navigation, /href="\/demos"/);
  assert.match(sitemap, /"\/demos"/);
});

test("includes durable trial, live checkout and one-time product login grants", async () => {
  const [schema, trialRoute, activationRoute, passwordRoute, checkoutRoute, statusClient, plansPage, loginRoute, loginClient, worker, hosting] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/activate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trial/status/status-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plans/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/login/login-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /trial_requests/);
  assert.match(schema, /analytics_events/);
  assert.match(trialRoute, /status: "requested"/);
  assert.match(activationRoute, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(schema, /automation_token/);
  assert.match(passwordRoute, /trial-password/);
  assert.match(passwordRoute, /credentialsSetAt/);
  assert.match(checkoutRoute, /result\.mode === "live"/);
  assert.match(checkoutRoute, /trial_\$\{mode\}_checkout_started/);
  assert.match(statusClient, /Activate my 30-day trial/);
  assert.match(statusClient, /Secure live checkout/);
  assert.doesNotMatch(plansPage, /currently being verified in Stripe test mode/);
  assert.match(loginRoute, /\/auth\/portal-claim/);
  assert.match(loginRoute, /portal-broker\.internal/);
  assert.match(loginRoute, /includePlatform: !selected && ownerEmailAllowed\(email\)/);
  assert.doesNotMatch(loginRoute, /directUrl: "https:\/\/owner\.corecaresystems\.co\.uk/);
  assert.match(loginClient, /Object\.entries\(\{ grant, returnTo/);
  assert.doesNotMatch(loginClient, /Object\.entries\(\{ email, password/);
  assert.doesNotMatch(loginRoute, /workers\.dev/);
  assert.doesNotMatch(loginRoute, /Domain=\.corecaresystems\.co\.uk/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});

test("protects every public write form with end-to-end Turnstile validation", async () => {
  const [widget, helper, loginPage, loginClient, trialClient, contactClient, rightsClient, loginRoute, trialRoute, contactRoute, rightsRoute, config] = await Promise.all([
    readFile(new URL("../app/turnstile-widget.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/_shared/turnstile.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/login-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/trial/trial-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/contact/contact-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data-rights/data-rights-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/contact/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/privacy/requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.cloudflare.jsonc", import.meta.url), "utf8"),
  ]);
  assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(widget, /window\.turnstile\.reset/);
  for (const [source, action] of [[loginClient, "login"], [trialClient, "trial"], [contactClient, "contact"], [rightsClient, "data_rights"]]) {
    assert.match(source, new RegExp(`action="${action}"`));
    assert.match(source, /turnstileToken/);
  }
  for (const [source, action] of [[loginRoute, "login"], [trialRoute, "trial"], [contactRoute, "contact"], [rightsRoute, "data_rights"]]) {
    assert.match(source, new RegExp(`verifyTurnstile\\(request, .*turnstileToken, "${action}"\\)`));
  }
  assert.match(helper, /result\.success === true/);
  assert.match(helper, /result\.action === expectedAction/);
  assert.match(helper, /expectedHostnames\.has/);
  assert.match(helper, /AbortSignal\.timeout\(10_000\)/);
  assert.match(loginPage, /host !== "login\.corecaresystems\.co\.uk"/);
  assert.match(loginPage, /redirect\(destination\.toString\(\)\)/);
  assert.match(config, /"pattern": "login\.corecaresystems\.co\.uk"/);
  assert.doesNotMatch(config, /"pattern": "www\.corecaresystems\.co\.uk"/);
  assert.match(config, /TURNSTILE_HOSTNAMES/);
  assert.doesNotMatch(config, /TURNSTILE_SECRET/);
});
