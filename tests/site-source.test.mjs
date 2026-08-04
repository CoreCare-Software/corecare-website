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

test("includes durable trial and unified login routes", async () => {
  const [schema, trialRoute, loginRoute, hosting] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/trials/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/login/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /trial_requests/);
  assert.match(trialRoute, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(loginRoute, /Domain=\.corecaresystems\.co\.uk/);
  assert.equal(JSON.parse(hosting).d1, "DB");
});
