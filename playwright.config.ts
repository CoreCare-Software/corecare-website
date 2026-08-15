import { defineConfig } from "@playwright/test";

// Staging-only browser acceptance harness for the CoreCare One Login journey.
// This must never be pointed at a production origin: STAGING_ORIGIN is the
// only base URL this config accepts, and the credential used by the spec is
// resolved exclusively through the protected fixture credential artifact
// (never a hardcoded or arbitrary email/password).
const STAGING_ORIGIN = process.env.CORECARE_STAGING_ORIGIN
  || "https://corecare-website-staging.cselectricalservices11.workers.dev";

if (/(?<!-)corecaresystems\.co\.uk$/.test(new URL(STAGING_ORIGIN).hostname)) {
  throw new Error("Refusing to run browser acceptance against a production-looking origin.");
}

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "test-results/browser-acceptance.json" }]],
  use: {
    baseURL: STAGING_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
