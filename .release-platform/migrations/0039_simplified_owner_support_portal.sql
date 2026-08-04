-- CoreCare Platform 1.2.0 simplified owners and support portal
CREATE TABLE IF NOT EXISTS platform_product_organisations (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL, organisation_id TEXT NOT NULL, health_status TEXT NOT NULL DEFAULT 'healthy',
 error_count_24h INTEGER NOT NULL DEFAULT 0, database_status TEXT NOT NULL DEFAULT 'monitoring', auth_status TEXT NOT NULL DEFAULT 'monitoring',
 integration_status TEXT NOT NULL DEFAULT 'monitoring', last_health_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(product_id,organisation_id), FOREIGN KEY(product_id) REFERENCES platform_products(id), FOREIGN KEY(organisation_id) REFERENCES organisations(id)
);
CREATE INDEX IF NOT EXISTS idx_product_organisations_product ON platform_product_organisations(product_id,health_status);
INSERT OR IGNORE INTO platform_product_organisations(id,product_id,organisation_id,health_status,last_health_at)
SELECT 'ppo-care-' || id,'product-care',id,'healthy',CURRENT_TIMESTAMP FROM organisations;
