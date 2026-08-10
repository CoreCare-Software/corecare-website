# Website data separation and cutover

The public website uses its own D1 database, `corecare-website`. It must never be rebound to the CoreCare Platform database. Staging uses `corecare-website-staging` and private service bindings to `corecare-platform-staging`.

## Safety conditions

- Complete the staging deployment and all local/CI checks first.
- Create `WEBSITE_TOKEN_ENCRYPTION_KEY` independently in staging and production as a Worker secret. Never put its value in Git, logs, exports, tickets, or documentation.
- Record a D1 Time Travel bookmark for the source Platform database before copying data.
- Treat any SQL export as restricted personal data: encrypt it at rest, restrict access, and destroy it after row counts and sampled records are verified.
- Do not change Stripe configuration, Stripe data, or checkout logic during this cutover.

## Approved cutover sequence

1. Deploy the website to staging so Cloudflare provisions the staging D1 database.
2. Apply all website migrations to staging and complete form, trial-status, login-broker, privacy-request, and expiry tests.
3. Provision the production website D1 database without moving the public route.
4. Apply all migrations to the empty production website database.
5. Pause public form writes for a short announced maintenance window.
6. Export data only from `trial_requests`, `contact_requests`, `form_rate_limits`, `analytics_events`, and `privacy_requests` in the Platform D1 database using `wrangler d1 export --no-schema --table ...`.
7. Import the restricted data-only export into `corecare-website`, then compare row counts and representative records without printing personal data or capability tokens.
8. Deploy the verified website release and run the smoke tests. Resume form writes only after those checks pass.
9. Retain the source tables unchanged through the rollback window. Do not delete them as part of the cutover.

Legacy plaintext capability values are migrated lazily on first valid use: their hashes and expiry times are stored, internal automation values are encrypted with AES-GCM, and the legacy plaintext columns are cleared. New records never store a usable public capability token in plaintext.

## Rollback

If validation fails, restore the prior website Worker version and its prior D1 binding. If data restoration is required, restore from the recorded D1 Time Travel bookmark into an isolated database first, validate it, and only then change a binding. Never overwrite the only recoverable copy.
