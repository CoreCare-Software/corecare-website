-- CoreCare Platform 1.5.0 - Cross-product organisation access
ALTER TABLE platform_product_organisations ADD COLUMN external_organisation_id TEXT;
ALTER TABLE platform_product_organisations ADD COLUMN access_status TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS platform_access_grants (
 id TEXT PRIMARY KEY,
 support_session_id TEXT NOT NULL UNIQUE,
 product_id TEXT NOT NULL,
 organisation_id TEXT NOT NULL,
 code_hash TEXT NOT NULL UNIQUE,
 issued_by TEXT NOT NULL,
 access_mode TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 consumed_at TEXT,
 revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(support_session_id) REFERENCES platform_support_sessions(id),
 FOREIGN KEY(product_id) REFERENCES platform_products(id),
 FOREIGN KEY(organisation_id) REFERENCES organisations(id),
 FOREIGN KEY(issued_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_access_grants_lookup ON platform_access_grants(product_id,code_hash,expires_at);
CREATE INDEX IF NOT EXISTS idx_platform_access_grants_session ON platform_access_grants(support_session_id);

UPDATE platform_product_organisations
SET external_organisation_id=COALESCE(external_organisation_id,organisation_id),
    access_status=CASE WHEN access_status='pending' THEN 'ready' ELSE access_status END
WHERE product_id='product-care';
