# CoreCare Platform

CoreCare Platform is the software-owner command centre for the complete CoreCare ecosystem. Release 1.11.0 adds secure Stripe Checkout, customer billing portal access, signed webhook processing, payment-status synchronisation and Stripe-backed Limited and Unlimited subscriptions to the existing centrally enforced plan limits, recoverable archives, product-neutral customer, revenue, support, monitoring, entitlement, security, audit, maintenance and owner-account controls.

Organisation users use their individual CoreCare products. Only authorised CoreCare Platform personnel can enter this application. Platform support launches are short-lived, reason-based, role-restricted and recorded in the central audit log.

## Release safety

- Run `npm run verify` before deployment.
- Keep staging private behind Cloudflare Access before its first deployment.
- Export the production D1 database before applying a production migration.
- Keep at least two active Platform Owner accounts assigned to different trusted people.
- R2 is the preferred private attachment store. Until R2 is enabled, attachments retain the compatible D1 fallback.

See `PRODUCT-INTEGRATION.md` for the product contract and `docs/PLATFORM-RESILIENCE-RUNBOOK.md` for release and recovery procedures.
