-- CoreCare Platform 1.6.0 - central product onboarding and complete product context
ALTER TABLE platform_product_organisations ADD COLUMN provisioning_status TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE platform_product_organisations ADD COLUMN provisioned_at TEXT;
ALTER TABLE platform_product_organisations ADD COLUMN last_sync_at TEXT;
ALTER TABLE platform_product_organisations ADD COLUMN last_sync_error TEXT;
ALTER TABLE platform_product_organisations ADD COLUMN product_summary_json TEXT;

ALTER TABLE platform_support_tickets ADD COLUMN metadata_json TEXT;
ALTER TABLE platform_support_tickets ADD COLUMN access_requested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE platform_support_tickets ADD COLUMN access_request_mode TEXT;
ALTER TABLE platform_support_tickets ADD COLUMN submitted_at TEXT;

CREATE TABLE IF NOT EXISTS platform_onboarding_events (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  organisation_id TEXT NOT NULL,
  external_organisation_id TEXT,
  status TEXT NOT NULL,
  detail_json TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES platform_products(id),
  FOREIGN KEY(organisation_id) REFERENCES organisations(id),
  FOREIGN KEY(created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_onboarding_product_org
  ON platform_onboarding_events(product_id, organisation_id, created_at DESC);

-- Connect the live demonstration organisations so tickets, monitoring and
-- support access use the same central-to-product identity mapping.
INSERT INTO platform_product_organisations
  (id,product_id,organisation_id,external_organisation_id,access_status,provisioning_status,
   health_status,database_status,auth_status,integration_status,provisioned_at,updated_at)
SELECT 'ppo-pos-org-demo',p.id,'org-demo','org-demo','ready','ready',
       'unknown','monitoring','monitoring','connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM platform_products p WHERE p.code='POS'
ON CONFLICT(product_id,organisation_id) DO UPDATE SET
  external_organisation_id=excluded.external_organisation_id,
  access_status='ready',provisioning_status='ready',provisioned_at=CURRENT_TIMESTAMP,
  integration_status='connected',updated_at=CURRENT_TIMESTAMP;

INSERT INTO platform_product_organisations
  (id,product_id,organisation_id,external_organisation_id,access_status,provisioning_status,
   health_status,database_status,auth_status,integration_status,provisioned_at,updated_at)
SELECT 'ppo-garage-org-demo',p.id,'org-demo','org-demo','ready','ready',
       'unknown','monitoring','monitoring','connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM platform_products p WHERE p.code='GARAGE'
ON CONFLICT(product_id,organisation_id) DO UPDATE SET
  external_organisation_id=excluded.external_organisation_id,
  access_status='ready',provisioning_status='ready',provisioned_at=CURRENT_TIMESTAMP,
  integration_status='connected',updated_at=CURRENT_TIMESTAMP;

INSERT INTO platform_product_organisations
  (id,product_id,organisation_id,external_organisation_id,access_status,provisioning_status,
   health_status,database_status,auth_status,integration_status,provisioned_at,updated_at)
SELECT 'ppo-campsite-org-demo',p.id,'org-demo','property-demo','ready','ready',
       'unknown','monitoring','monitoring','connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM platform_products p WHERE p.code='CAMPSITE'
ON CONFLICT(product_id,organisation_id) DO UPDATE SET
  external_organisation_id=excluded.external_organisation_id,
  access_status='ready',provisioning_status='ready',provisioned_at=CURRENT_TIMESTAMP,
  integration_status='connected',updated_at=CURRENT_TIMESTAMP;

INSERT INTO platform_product_organisations
  (id,product_id,organisation_id,external_organisation_id,access_status,provisioning_status,
   health_status,database_status,auth_status,integration_status,provisioned_at,updated_at)
SELECT 'ppo-finance-org-demo',p.id,'org-demo','demo-corecare-group','ready','ready',
       'unknown','monitoring','monitoring','connected',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM platform_products p WHERE p.code='FINANCE'
ON CONFLICT(product_id,organisation_id) DO UPDATE SET
  external_organisation_id=excluded.external_organisation_id,
  access_status='ready',provisioning_status='ready',provisioned_at=CURRENT_TIMESTAMP,
  integration_status='connected',updated_at=CURRENT_TIMESTAMP;
