# CoreCare Platform 1.11.0

## Secure Stripe Billing

This release connects the existing CoreCare Limited (£50/month) and Unlimited
(£150/month) plans to Stripe Billing without changing their database-enforced
user and client allowances.

### Included

- Stripe-hosted Checkout for a new monthly subscription.
- Stripe-hosted Customer Portal for payment methods, invoices, plan changes and
  cancellation.
- Raw-body HMAC verification for every Stripe webhook with a five-minute replay
  tolerance.
- Idempotent webhook storage so duplicate deliveries cannot apply a payment or
  subscription update twice.
- Automatic plan, payment status, renewal date and cancellation synchronisation
  into Organisation 360.
- Payment-failure status, owner audit entries and product-entitlement refreshes.
- Separate test/live mode detection. No key material is returned to the browser.
- Billing address and tax-ID collection. Automatic Stripe Tax is deliberately
  disabled unless `STRIPE_AUTOMATIC_TAX=true` is configured.

### Required one-time configuration

Configure and test staging first. Never paste a Stripe secret into source code,
Git, a support ticket or chat.

1. Add `STRIPE_SECRET_KEY` as a Cloudflare Worker secret using a Stripe test-mode
   restricted or secret key.
2. In Stripe, create a webhook endpoint for:
   `https://corecare-platform-staging.cselectricalservices11.workers.dev/api/billing/stripe/webhook`
3. Subscribe it to:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, and `invoice.payment_failed`.
4. Add the endpoint signing secret to the Worker as
   `STRIPE_WEBHOOK_SECRET`.
5. In Cloudflare Access, bypass authentication for the exact webhook path only.
   Do not bypass the rest of the CoreCare Platform host. Stripe signature
   verification remains mandatory at the Worker.
6. In Stripe test mode, enable the Customer Portal features needed by CoreCare.
7. Open an organisation's Commercial tab and select
   **Connect £50 and £150 plans**. This creates the matching GBP monthly product
   prices once and stores their Stripe IDs in D1.
8. Complete a test Checkout and confirm Organisation 360 updates from the signed
   webhook before repeating the same setup with live-mode keys in production.

### Cloudflare secrets

Production and staging secrets are deliberately separate:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

The optional `STRIPE_AUTOMATIC_TAX` setting is not enabled in this release.

### Rollback

The integration is dormant when its Stripe secrets are absent. Removing the two
Stripe secrets disables new Stripe actions without deleting any Stripe or
CoreCare records. Migration `0051_stripe_billing.sql` is additive; existing
organisation, plan, support, audit and entitlement records are unchanged.
