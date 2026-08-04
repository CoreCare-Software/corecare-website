-- Stripe Billing is optional and remains dormant until the Worker secrets are
-- configured. CoreCare's existing plan and entitlement records remain the
-- local enforcement boundary; Stripe becomes the payment-status authority for
-- organisations whose billing_provider is set to stripe.

ALTER TABLE subscription_plans ADD COLUMN stripe_product_id TEXT;
ALTER TABLE subscription_plans ADD COLUMN stripe_price_id TEXT;

ALTER TABLE organisations ADD COLUMN billing_provider TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE organisations ADD COLUMN billing_email TEXT;
ALTER TABLE organisations ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE organisations ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE organisations ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE organisations ADD COLUMN stripe_price_id TEXT;
ALTER TABLE organisations ADD COLUMN stripe_status TEXT;
ALTER TABLE organisations ADD COLUMN stripe_current_period_end TEXT;
ALTER TABLE organisations ADD COLUMN stripe_cancel_at_period_end INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organisations ADD COLUMN stripe_livemode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organisations ADD COLUMN stripe_last_event_at TEXT;
ALTER TABLE organisations ADD COLUMN stripe_last_payment_at TEXT;
ALTER TABLE organisations ADD COLUMN stripe_last_payment_amount_pence INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_stripe_customer
  ON organisations(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organisations_stripe_subscription
  ON organisations(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  organisation_id TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  error_message TEXT,
  stripe_created_at TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_received
  ON stripe_webhook_events(received_at DESC,event_type);

CREATE TABLE IF NOT EXISTS stripe_checkout_sessions (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (organisation_id) REFERENCES organisations(id),
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_organisation
  ON stripe_checkout_sessions(organisation_id,created_at DESC);
