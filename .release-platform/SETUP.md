# CoreCare Platform setup

## Local verification

1. Install the locked dependencies with `npm ci`.
2. Run `npm run verify`.
3. Use `.dev.vars` for local secrets; never commit it.

## Cloudflare resources

- Production Worker: `corecare-platform`
- Production D1: `corecare-platform`
- Staging D1: `corecare-platform-staging`
- Production and staging must each have their own Cloudflare Access application and owner-only MFA policy.
- Product credentials are Wrangler secrets and are never stored in source.
- The optional `ATTACHMENTS` R2 binding must point to a private bucket.

## Safe deployment order

1. Run `npm run verify`.
2. Confirm Cloudflare Access protects the target hostname.
3. Apply and validate staging migrations.
4. Deploy and test staging only after its Access policy exists.
5. Export production D1 to a private ignored backup file.
6. Run `npm run db:migrate:remote`.
7. Run `npm run deploy`.
8. Verify live health, login, audit integrity, support visibility and feature-delivery status.

See `PRODUCT-INTEGRATION.md` and `docs/PLATFORM-RESILIENCE-RUNBOOK.md` for the connected-product and recovery contracts.
