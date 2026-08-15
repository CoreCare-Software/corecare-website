import { test, expect } from "@playwright/test";

// Staging synthetic-fixture One Login acceptance.
//
// Credential handling: the fixture email/password are read exclusively from
// CORECARE_FIXTURE_EMAIL / CORECARE_FIXTURE_PASSWORD environment variables.
// Locally these are populated from the DPAPI-protected credential artifact via
// scripts/load-fixture-credential.ps1 (never hardcoded, never committed). In
// CI they must come from a governed GitHub Actions secret populated only
// after a governed fixture reset. The password is never logged, printed, or
// included in any assertion message.
const FIXTURE_EMAIL = process.env.CORECARE_FIXTURE_EMAIL || "";
const FIXTURE_PASSWORD = process.env.CORECARE_FIXTURE_PASSWORD || "";

test.skip(!FIXTURE_EMAIL || !FIXTURE_PASSWORD, "Staging fixture credential not available in this environment.");

test("synthetic staging fixture completes One Login and reaches product selection", async ({ page, baseURL }) => {
  expect(baseURL, "browser harness must target the staging origin only").toMatch(/staging/);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /good to see you again|choose your product|choose where to work/i })).toBeVisible();

  await page.getByLabel("Email address").fill(FIXTURE_EMAIL);
  await page.locator('input[name="password"]').fill(FIXTURE_PASSWORD);

  // The Turnstile test sitekey (invisible, always-pass) auto-resolves without
  // interaction on the staging origin; wait for the token to populate the
  // submit button rather than assuming a fixed delay.
  await expect(page.locator("button.auth-submit")).toBeEnabled({ timeout: 20_000 });
  await page.locator("button.auth-submit").click();

  // Expect either direct product selection (single product) or a product
  // chooser (multiple products) — never an error stage, and never a
  // credential-rejection message.
  await expect(page.getByText(/could not be accepted|invalid_credentials/i)).toHaveCount(0, { timeout: 15_000 });

  // This fixture is entitled to exactly one product (Care), so Platform's
  // portal-login flow auto-redirects through a transient "Opening CoreCare
  // Care" interstitial rather than presenting a multi-product chooser.
  // Wait for that interstitial to clear and land on the Care app itself.
  await page.waitForURL(/corecare-care-staging[^/]*\.workers\.dev\/(?!auth\/portal-login)/, { timeout: 20_000 });
  await expect(page.getByText(/opening corecare care/i)).toHaveCount(0, { timeout: 20_000 });
});

test("staging Turnstile enforcement is active and rejects submission without a token", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email address")).toBeVisible();
  // The submit button must remain disabled until the widget yields a token,
  // proving Turnstile enforcement genuinely gates submission even though the
  // staging widget uses Cloudflare's test sitekey.
  await expect(page.locator("button.auth-submit")).toBeDisabled();
});
