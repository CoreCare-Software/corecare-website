# CoreCare Platform security review

Last reviewed: 4 August 2026  
Reviewed release: 1.9.0

## Current controls

- Owner and administrator checks protect platform-changing operations.
- Product support modes are restricted by platform role.
- Read-only Support Mode and emergency freeze are enforced by the Worker, not only by the browser.
- State-changing browser requests require the Platform origin.
- Password hashing uses PBKDF2-HMAC-SHA-256 with 600,000 iterations; older hashes are upgraded after successful sign-in.
- Sign-in throttling applies to both account/IP and IP-wide attempts, and failed known-account attempts are recorded.
- Absolute and idle session expiry are server-enforced. The owner workspace policy is 8 hours absolute and 30 minutes idle.
- Temporary-password users cannot access other application APIs before changing their password.
- Platform owners can create, disable, re-enable and reset Platform accounts, revoke all of an account's sessions, and cannot disable or demote the final active owner.
- The command centre warns when fewer than two independent owner accounts remain active.
- Product credentials use timing-safe comparison; product access grants are single-use and automatically expire.
- Product feature changes remain visibly pending until the target product acknowledges the exact version and checksum it applied.
- Request, attachment and connected-product response sizes are bounded.
- Attachments are checksum-addressed and use a private R2 binding when available, with the existing D1 format retained as a compatible fallback.
- Security response headers and no-store/no-index policies are applied to the application and API.
- Every support access event remains reason-based and audited.
- Scheduled retention maintenance records its result and creates chained SHA-256 audit checkpoints.
- Platform settings no longer claim to enforce local MFA or trusted-device controls. Those controls are explicitly identified as Cloudflare Access responsibilities.

## Verified

- Automated tests: 30 unit tests and 2 Cloudflare Worker-runtime tests passing.
- Cloudflare deployment dry-run: passing.
- Production dependency audit: no vulnerabilities.
- Live unauthenticated control-centre request: intercepted by Cloudflare Access and redirected to owner sign-in.
- Live stale browser sessions: 0.
- Live stale active product support sessions: 0.
- Live unconsumed access grants: 0.
- Dedicated D1 migration: 86 application tables copied inside Cloudflare; key organisation, user, product, support and audit totals match the retained source.
- Live scheduled product monitoring: writing to the dedicated `corecare-platform` database.
- A clean staging D1 database successfully applies the complete 50-file migration chain through `0049_platform_resilience_and_governance.sql`.

## Infrastructure status

- The production Worker is restricted by Cloudflare Access to the approved owner identity. The Access application allows biometric, security-key or authenticator-app MFA and uses an 8-hour authentication duration.
- CoreCare Platform uses its own `corecare-platform` D1 database in Western Europe. CoreCare Care remains on the original `corecare` database, which is retained as the migration rollback source.

## Ongoing operations

- Use a narrowly scoped Cloudflare API token for automation instead of a broadly scoped interactive login.
- Review active owner accounts, sessions, support grants and failed sign-ins regularly.
- Monitor Cloudflare's current Wrangler release for a patched local Miniflare/Undici dependency. The reported advisory is development-only; the deployed Worker has no affected production dependency.
- Back up D1 before schema or data migrations and test recovery periodically.
- Do not publish the staging Worker until a separate Cloudflare Access application and owner-only MFA policy protect its hostname.
- Enable Cloudflare R2, provision a private Platform bucket and add the `ATTACHMENTS` binding before moving new attachment payloads out of D1.
