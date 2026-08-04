# CoreCare Platform resilience runbook

## Owner recovery

Keep at least two active `platform_owner` accounts, each assigned to a different trusted person. Test both accounts quarterly. Do not share passwords. Cloudflare Access MFA remains the outer identity boundary; the CoreCare password is the application boundary.

## Release path

1. Run `npm run verify`.
2. Apply migrations to staging with `npm run db:migrate:staging`.
3. Confirm a separate Cloudflare Access application protects the staging hostname with an owner-only MFA policy. Do not deploy staging before this exists.
4. Deploy staging with `npm run deploy:staging` and verify login, product monitoring, support access, tickets and feature delivery.
5. Back up or export D1 before a production migration.
6. Apply production migrations with `npm run db:migrate:remote`.
7. Deploy production with `npm run deploy`.
8. Verify `/api/health`, Platform login, audit log, each product health tile, one read-only support session and one entitlement acknowledgement.

## Rollback

The migration is additive. Roll back the Worker deployment to the prior version in Cloudflare. Do not delete the added tables or R2 objects. Existing `data_url` attachment records remain usable by the prior release.

## Audit integrity

Scheduled maintenance creates chained SHA-256 audit checkpoints. When R2 is enabled, checkpoint payloads are also written to the private Platform bucket. Investigate a missing checkpoint, a failed maintenance run, or a chain/hash mismatch as a security event.

## Attachments

R2 is the preferred object store. Until R2 is enabled for the account and the `ATTACHMENTS` binding is configured, the Worker deliberately retains the legacy D1 attachment path. Never expose the bucket publicly.
