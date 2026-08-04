-- CoreCare Platform 1.2.2
-- Repair the legacy platform_incidents table created by migration 0017.
-- Migration 0038 used CREATE TABLE IF NOT EXISTS, so these newer columns
-- were not added to existing databases.
ALTER TABLE platform_incidents ADD COLUMN product_id TEXT;
ALTER TABLE platform_incidents ADD COLUMN public_message TEXT;
ALTER TABLE platform_incidents ADD COLUMN internal_notes TEXT;
ALTER TABLE platform_incidents ADD COLUMN created_at TEXT;

UPDATE platform_incidents
SET created_at = COALESCE(created_at, started_at, updated_at, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_incidents_product
ON platform_incidents(product_id, status, created_at DESC);
