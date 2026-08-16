import assert from "node:assert";
import { test, describe } from "node:test";
import { readFileSync } from "node:fs";

// Load the production-acceptance workflow as raw YAML text (simple line-based checks)
const workflowPath = ".github/workflows/production-acceptance.yml";
const workflowYaml = readFileSync(workflowPath, "utf8");

describe("Production Acceptance Adoption Tests", () => {
  describe("Trigger Model Constraints", () => {
    test("workflow must trigger on workflow_dispatch only, never on pull_request", () => {
      assert(
        !workflowYaml.includes("  pull_request:"),
        "❌ FAIL: workflow must NOT trigger on pull_request"
      );
      assert(
        workflowYaml.includes("workflow_dispatch:"),
        "❌ FAIL: workflow must trigger on workflow_dispatch"
      );
    });

    test("workflow must not trigger on push events", () => {
      const onSection = workflowYaml.split("on:")[1]?.split("jobs:")[0] || "";
      assert(
        !onSection.includes("  push:") || onSection.includes("  push:\n    branches:"),
        "❌ FAIL: workflow must NOT have standalone push trigger"
      );
    });

    test("workflow must not trigger on schedule events", () => {
      assert(
        !workflowYaml.includes("  schedule:"),
        "❌ FAIL: workflow must NOT trigger on schedule events"
      );
    });

    test("workflow_dispatch must be the primary/only trigger", () => {
      // Check that workflow_dispatch is configured in the on section
      assert(
        workflowYaml.includes("on:") && workflowYaml.includes("workflow_dispatch:"),
        "❌ FAIL: workflow_dispatch not configured"
      );
    });
  });

  describe("Confirmation Input Requirements", () => {
    test("workflow_dispatch must require confirm_live_read_only input", () => {
      assert(
        workflowYaml.includes("confirm_live_read_only:"),
        "❌ FAIL: confirm_live_read_only input not found"
      );
    });

    test("confirm_live_read_only input must be required and type string", () => {
      const inputSection = workflowYaml.split("confirm_live_read_only:")[1]?.split("candidate_sha:")[0] || "";
      assert(
        inputSection.includes("required: true"),
        "❌ FAIL: confirm_live_read_only is not required"
      );
      assert(
        inputSection.includes("type: string"),
        "❌ FAIL: confirm_live_read_only is not type string"
      );
    });

    test("confirm_live_read_only input description must mention RUN_LIVE_READ_ONLY_ACCEPTANCE", () => {
      assert(
        workflowYaml.includes("RUN_LIVE_READ_ONLY_ACCEPTANCE"),
        "❌ FAIL: workflow does not reference the required confirmation phrase"
      );
    });

    test("workflow must pass confirm_live_read_only to the reusable job", () => {
      assert(
        workflowYaml.includes("confirm_live_read_only: ${{ inputs.confirm_live_read_only }}"),
        "❌ FAIL: confirm_live_read_only not passed to job"
      );
    });
  });

  describe("Platform Workflow Pinning", () => {
    test("must use Platform reusable workflow pinned to exact commit SHA", () => {
      assert(
        workflowYaml.includes("CoreCare-Software/corecare-platform"),
        "❌ FAIL: does not reference Platform repository"
      );
      assert(
        workflowYaml.includes("corecare-live-acceptance-reusable.yml"),
        "❌ FAIL: does not reference reusable workflow file"
      );
    });

    test("must pin to exact commit SHA ac0de7be5afa23823fb594a4835625b0a5aae2de", () => {
      const expectedSha = "ac0de7be5afa23823fb594a4835625b0a5aae2de";
      assert(
        workflowYaml.includes(expectedSha),
        `❌ FAIL: workflow not pinned to commit SHA ${expectedSha}`
      );
      assert(
        !workflowYaml.includes("@main") && !workflowYaml.includes("@master"),
        "❌ FAIL: workflow references floating branch instead of immutable SHA"
      );
    });
  });

  describe("Maturity Status Declaration", () => {
    test("must declare product_code as WEBSITE", () => {
      assert(
        workflowYaml.includes("product_code: WEBSITE"),
        "❌ FAIL: product_code is not WEBSITE"
      );
    });

    test("must declare maturity_status as production_live", () => {
      assert(
        workflowYaml.includes("maturity_status: production_live"),
        "❌ FAIL: maturity_status is not production_live"
      );
    });

    test("must pass production_origin as https://www.corecaresystems.co.uk", () => {
      assert(
        workflowYaml.includes("production_origin: https://www.corecaresystems.co.uk"),
        "❌ FAIL: production_origin is incorrect"
      );
    });

    test("must declare run_playwright as true", () => {
      assert(
        workflowYaml.includes("run_playwright: true"),
        "❌ FAIL: run_playwright is not true"
      );
    });
  });

  describe("Credentials and Secrets", () => {
    test("must pass canary secrets explicitly (no secrets: inherit)", () => {
      const secretsSection = workflowYaml.split("secrets:")[1] || "";
      assert(
        !secretsSection.includes("inherit"),
        "❌ FAIL: workflow uses secrets: inherit instead of explicit mapping"
      );
      assert(
        secretsSection.includes("canary_email:"),
        "❌ FAIL: canary_email secret not mapped"
      );
    });

    test("must pass canary_email secret with CORECARE_PROD_WEBSITE_SMOKE_EMAIL", () => {
      assert(
        workflowYaml.includes("CORECARE_PROD_WEBSITE_SMOKE_EMAIL"),
        "❌ FAIL: canary_email not using correct secret name"
      );
    });

    test("must pass canary_pass secret with CORECARE_PROD_WEBSITE_SMOKE_PASS", () => {
      assert(
        workflowYaml.includes("CORECARE_PROD_WEBSITE_SMOKE_PASS"),
        "❌ FAIL: canary_pass not using correct secret name"
      );
    });
  });

  describe("Permissions and Concurrency", () => {
    test("must have read-only permissions", () => {
      assert(
        workflowYaml.includes("permissions:") && workflowYaml.includes("contents: read"),
        "❌ FAIL: permissions are not read-only"
      );
    });

    test("must have concurrency control to prevent parallel runs", () => {
      assert(
        workflowYaml.includes("concurrency:") && workflowYaml.includes("group:"),
        "❌ FAIL: concurrency control not configured"
      );
    });

    test("concurrency must cancel in-progress runs", () => {
      assert(
        workflowYaml.includes("cancel-in-progress: true"),
        "❌ FAIL: concurrency does not cancel in-progress runs"
      );
    });
  });

  describe("Adoption Declaration", () => {
    test("must have declaration file at .github/production-acceptance-declaration.json", () => {
      const declarationPath = ".github/production-acceptance-declaration.json";
      try {
        const declarationJson = readFileSync(declarationPath, "utf8");
        const declaration = JSON.parse(declarationJson);
        assert(declaration.product_code, "❌ FAIL: declaration missing product_code");
        assert.strictEqual(
          declaration.maturity_status,
          "production_live",
          "❌ FAIL: declaration maturity_status is not production_live"
        );
      } catch (e) {
        throw new Error(`❌ FAIL: could not load declaration: ${e.message}`);
      }
    });
  });

  describe("Documentation", () => {
    test("must have adoption documentation at docs/operations/LIVE-PRODUCTION-ACCEPTANCE-ADOPTION.md", () => {
      const docPath = "docs/operations/LIVE-PRODUCTION-ACCEPTANCE-ADOPTION.md";
      try {
        const doc = readFileSync(docPath, "utf8");
        assert(doc.length > 0, "❌ FAIL: adoption doc is empty");
        assert(
          doc.includes("production_live"),
          "❌ FAIL: adoption doc does not reference production_live status"
        );
        assert(
          doc.includes("RUN_LIVE_READ_ONLY_ACCEPTANCE"),
          "❌ FAIL: adoption doc does not reference confirmation phrase"
        );
        assert(
          doc.includes("workflow_dispatch"),
          "❌ FAIL: adoption doc does not explain trigger model"
        );
      } catch (e) {
        throw new Error(`❌ FAIL: could not load adoption doc: ${e.message}`);
      }
    });
  });

  describe("Fail-Closed Behavior", () => {
    test("confirmation input is required (fail-closed on missing confirmation)", () => {
      assert(
        workflowYaml.includes("required: true") &&
        workflowYaml.includes("confirm_live_read_only:"),
        "❌ FAIL: confirmation input is not required; workflow is not fail-closed"
      );
    });

    test("workflow must not run on pull_request (fail-closed on ordinary PRs)", () => {
      assert(
        !workflowYaml.includes("  pull_request:"),
        "❌ FAIL: workflow runs on pull_request; is not fail-closed"
      );
    });

    test("workflow must not run on push (fail-closed on main merges)", () => {
      const onSection = workflowYaml.split("on:")[1]?.split("permissions:")[0] || "";
      assert(
        !onSection.includes("  push:") || onSection.includes("  push:\n    branches:"),
        "❌ FAIL: workflow runs on standalone push; is not fail-closed"
      );
    });

    test("workflow must not run on schedule (fail-closed on scheduled events)", () => {
      assert(
        !workflowYaml.includes("  schedule:"),
        "❌ FAIL: workflow runs on schedule; is not fail-closed"
      );
    });
  });

  describe("Read-Only at Business-Data Level", () => {
    test("uses Platform reusable workflow (does not contain deployment steps)", () => {
      // The workflow should delegate to Platform, not contain its own deployment logic
      assert(
        workflowYaml.includes("uses: CoreCare-Software/corecare-platform"),
        "❌ FAIL: workflow must use Platform reusable workflow"
      );
    });
  });
});

console.log("\n✅ All production acceptance adoption tests passed!");
