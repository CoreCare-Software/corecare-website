# CoreCare Website — Live Production Acceptance Adoption

**Status**: ADOPTED  
**Maturity Level**: `production_live`  
**Adoption Date**: 2026-08-16  
**Standard Version**: `CORECARE_LIVE_PRODUCTION_ACCEPTANCE_STANDARD_V1`

---

## Reference

The canonical CoreCare Live Production Acceptance Standard is owned and maintained by CoreCare Platform at:

- **Standard Document**: [CORECARE-LIVE-PRODUCTION-ACCEPTANCE-STANDARD-V1.md](https://github.com/CoreCare-Software/corecare-platform/blob/ac0de7be5afa23823fb594a4835625b0a5aae2de/docs/CORECARE-LIVE-PRODUCTION-ACCEPTANCE-STANDARD-V1.md)
- **Reusable Workflow**: [corecare-live-acceptance-reusable.yml](https://github.com/CoreCare-Software/corecare-platform/blob/ac0de7be5afa23823fb594a4835625b0a5aae2de/.github/workflows/corecare-live-acceptance-reusable.yml)  
  (pinned at commit: `ac0de7be5afa23823fb594a4835625b0a5aae2de`)

All implementation details, trigger constraints, identity boundaries, write restrictions, and evidence requirements are documented in the Platform repository. This document summarizes the adoption status and product-specific configuration for the Website.

---

## Adoption Summary

### What

CoreCare Website has adopted the canonical live production acceptance standard. This means:

- Manual acceptance runs can be triggered via `workflow_dispatch` from the GitHub Actions UI
- All acceptance runs execute read-only canary journeys against the production Website
- A deliberate confirmation phrase (`RUN_LIVE_READ_ONLY_ACCEPTANCE`) must be supplied
- Acceptance is never automatic on pull requests, main merges, or scheduled events
- Evidence is collected and uploaded as workflow artifacts

### Why

The Website is a `production_live` customer-facing product serving:

- Unified product login entry point (One Login integration)
- Trial request processing and durable storage (D1)
- Customer contact form submissions and durable storage (D1)
- Service-event recording for customer engagement
- Public product showcase and demonstration content
- Production security headers and privacy pages

Because the Website processes real customer data and serves production traffic, it qualifies for live production acceptance testing.

### Maturity Level

**`production_live`**

The Website meets the criteria for production live status:

- ✅ Deployed to production infrastructure (`https://www.corecaresystems.co.uk`)
- ✅ Serves real customers and customer-facing features
- ✅ Processes production customer data (trials, contacts, service events)
- ✅ Integrated with production One Login system
- ✅ Has D1 database for durable customer-facing records
- ✅ Has production compliance controls (GDPR, data protection, breach handling)
- ✅ Has verify.yml validation on all PRs and main merges
- ✅ Has staged rollout (staging deployment for pre-production testing)

---

## Caller Workflow

**Location**: `.github/workflows/production-acceptance.yml`

This is the thin product-specific wrapper that:

1. Triggers only on `workflow_dispatch` (manual only)
2. Requires the exact confirmation phrase: `RUN_LIVE_READ_ONLY_ACCEPTANCE`
3. Pins the Platform reusable workflow to the immutable commit SHA
4. Passes product-specific inputs:
   - `product_code: WEBSITE`
   - `production_origin: https://www.corecaresystems.co.uk`
   - `health_path: /api/health`
   - `version_path: /api/version`
   - `maturity_status: production_live`
   - `run_playwright: true` (enables browser canary journeys)
5. Passes secrets explicitly (no `secrets: inherit`)

The wrapper delegates all logic to the Platform reusable workflow. No acceptance logic lives in the product repository.

---

## Acceptance Scope

The acceptance workflow performs read-only canary checks:

### ✅ Permitted checks

- **Health and version endpoints**: Verify production Website responds and reports health
- **One Login authentication**: Test canary account login flow and MFA routing
- **Trial request form access**: Verify form pages load and accept inputs
- **Product chooser access**: Verify product navigation and switching works
- **Care/staff landing pages**: Verify product-specific pages are accessible
- **Permission-denied checks**: Verify cross-tenant denial and access controls
- **Logout and session cleanup**: Ensure temporary sessions are revoked
- **Drift and evidence collection**: Record actual production state and deployment

### ❌ Prohibited operations

- Form submission (no new trials, contacts, or service events created)
- Database mutations or writes
- Credential or MFA changes
- User creation or invitation
- Any transactional operation
- Any customer data modification

---

## Canary Credentials

Acceptance runs use dedicated synthetic canary credentials managed by CoreCare:

| Credential | Purpose | Secret Name | Managed By |
|-----------|---------|-------------|-----------|
| Canary email | One Login authentication | `CORECARE_PROD_WEBSITE_SMOKE_EMAIL` | GitHub Actions (production environment) |
| Canary password | One Login password | `CORECARE_PROD_WEBSITE_SMOKE_PASS` | GitHub Actions (production environment) |

These credentials are associated with a synthetic canary user account in production One Login — not a real customer, staff member, or test user. They are used exclusively for automated acceptance testing.

---

## Running an Acceptance Check

### Manual trigger (production acceptance)

1. Navigate to **Actions** → **CoreCare Website Production Canary Acceptance**
2. Click **Run workflow**
3. Enter confirmation: `RUN_LIVE_READ_ONLY_ACCEPTANCE` (exact match required)
4. (Optional) Enter a specific commit SHA; defaults to HEAD
5. Click **Run workflow**

The workflow will:

1. Validate the confirmation phrase
2. Check maturity status (must be `production_live`)
3. Verify secrets are available
4. Run health/version checks against production
5. Run browser-based One Login canary journey (if credentials available)
6. Upload evidence artifacts

Evidence is available in **Artifacts** under the workflow run summary.

### Automation: never

Acceptance runs **cannot** be triggered automatically by:
- Pull request events
- Push to main
- Scheduled cron events
- GitHub merge groups
- Any other GitHub Actions trigger

The workflow enforces `workflow_dispatch` only. This is a permanent guarantee.

---

## Evidence and Auditing

Every acceptance run creates evidence artifacts:

| Artifact | Content |
|----------|---------|
| `website-canary-evidence-health-{sha}` | Health/version check results and metadata |
| `website-canary-evidence-{sha}` | Playwright browser journey results (if run) |
| `website-canary-evidence-maturity-{sha}` | Maturity gate decision and blockers (if applicable) |

Evidence is retention-locked per GitHub organizational policy and available for audit, compliance verification, and incident investigation.

---

## Troubleshooting

### Workflow fails on confirmation

**Cause**: Confirmation phrase does not match exactly  
**Fix**: Use `RUN_LIVE_READ_ONLY_ACCEPTANCE` (case-sensitive, no extra spaces)

### Workflow fails on secrets

**Cause**: Canary credentials are not configured in GitHub Actions environment  
**Fix**: Add secrets to `CORECARE_PROD_WEBSITE_SMOKE_EMAIL` and `CORECARE_PROD_WEBSITE_SMOKE_PASS` in GitHub Actions (repository or environment level)

### Workflow fails on maturity gate

**Cause**: Maturity status is not `production_live`  
**Fix**: Contact CoreCare Platform team to review and update maturity classification

### Playwright journeys fail

**Cause**: Canary account is locked, credentials are wrong, or One Login is unavailable  
**Fix**: Verify canary credentials with CoreCare security team; check One Login production status

---

## Governance and Updates

### Changes to this adoption

Any changes to the Website production acceptance workflow or configuration must:

1. Be proposed via pull request to this repository
2. Include rationale and impact assessment
3. Reference the Platform standard and any governance exceptions
4. Pass all verify.yml checks
5. Be reviewed and approved by the Website and Platform teams

### Updates to the Platform standard

The canonical standard is owned by CoreCare Platform. When the Platform updates the standard:

1. Platform updates the reusable workflow and documentation
2. Products can adopt the new version by updating the pinned SHA in their production-acceptance.yml
3. Products document the update in their adoption README

The Website will maintain the pinned SHA until an upgrade is explicitly approved.

---

## Compliance Notes

- **No production deployment**: Acceptance workflow does not deploy code to production
- **No database migration**: Acceptance workflow does not run migrations
- **No credential mutation**: Acceptance workflow does not change production credentials
- **Read-only at business-data level**: All checks are observation-only
- **Audit trail**: All runs are logged in GitHub Actions and linked to exact source SHA
- **Evidence retention**: Acceptance evidence is retained per GitHub organizational policy
