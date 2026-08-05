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
  for (const name of ["CoreCare Care", "CoreCare Campsites", "CoreCare Finance", "CoreCare Garage", "CoreCare POS", "CoreCare Owner Platform"]) assert.match(products, new RegExp(name));
  assert.match(styles, /@media\(max-width:760px\)/);
});

test("includes interactive visual workflows for every CoreCare product", async () => {
  const [page, client, demos, navigation, sitemap] = await Promise.all([
    readFile(new URL("../app/demos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/demos/demo-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/demos/demo-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/site-chrome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /See every CoreCare product in action/);
  assert.match(client, /role="tabpanel"/);
  assert.match(client, /Representative demonstration/);
  for (const code of ["CARE", "CAMPSITE", "FINANCE", "GARAGE", "POS", "PLATFORM"]) assert.match(demos, new RegExp(`${code}:`));
  assert.match(navigation, /href="\/demos"/);
  assert.match(sitemap, /"\/demos"/);
});

test("includes durable trial, live checkout and product-owned login handoffs", async () => {
  const [schema, trialRoute, activationRoute, passwordRoute, checkoutRoute, statusClient, plansPage, loginRoute, worker, hosting] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/activate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/password/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/trial/status/status-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/plans/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/login/route.ts", import.meta.url), "utf8"),
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
  assert.match(loginRoute, /\/auth\/portal-login/);
  assert.doesNotMatch(loginRoute, /Domain=\.corecaresystems\.co\.uk/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});
