import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configUrl = new URL("../wrangler.cloudflare.jsonc", import.meta.url);

function serviceBindings(services) {
  return Object.fromEntries(
    services.map((service) => [service.binding, service]),
  );
}

test("production and staging expose the exact Website Platform bindings", async () => {
  const source = await readFile(configUrl, "utf8");
  const config = JSON.parse(source);
  const serviceKeys = source.match(/^\s*"services":/gm) ?? [];

  assert.equal(serviceKeys.length, 2, "expected one production and one staging services array");

  const production = serviceBindings(config.services);
  assert.deepEqual(Object.keys(production).sort(), [
    "CORECARE_PLATFORM_AUTOMATION",
    "CORECARE_PLATFORM_PORTAL",
  ]);
  assert.equal(production.CORECARE_PLATFORM_PORTAL.service, "corecare-platform");
  assert.equal(production.CORECARE_PLATFORM_PORTAL.entrypoint, "PortalBroker");
  assert.equal(production.CORECARE_PLATFORM_AUTOMATION.service, "corecare-platform");

  const staging = serviceBindings(config.env.staging.services);
  assert.deepEqual(Object.keys(staging).sort(), [
    "CORECARE_PLATFORM_AUTOMATION",
    "CORECARE_PLATFORM_PORTAL",
  ]);
  assert.equal(staging.CORECARE_PLATFORM_PORTAL.service, "corecare-platform-staging");
  assert.equal(staging.CORECARE_PLATFORM_PORTAL.entrypoint, "PortalBroker");
  assert.equal(staging.CORECARE_PLATFORM_AUTOMATION.service, "corecare-platform-staging");
});
