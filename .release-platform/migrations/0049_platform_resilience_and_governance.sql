-- CoreCare Platform 1.9.0 - resilience, entitlement delivery and governance.
-- Additive only. Existing D1 attachment data remains available as a rollback source.

ALTER TABLE platform_ticket_attachments ADD COLUMN storage_key TEXT;
ALTER TABLE platform_ticket_attachments ADD COLUMN checksum_sha256 TEXT;
ALTER TABLE platform_ticket_attachments ADD COLUMN storage_status TEXT NOT NULL DEFAULT 'legacy_d1';

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_ticket_attachment_storage_key
  ON platform_ticket_attachments(storage_key)
  WHERE storage_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_entitlement_sync (
  product_id TEXT NOT NULL,
  organisation_id TEXT NOT NULL,
  contract_version TEXT,
  contract_checksum TEXT,
  requested_at TEXT,
  acknowledged_at TEXT,
  applied_at TEXT,
  product_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','acknowledged','applied','failed')),
  error_message TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(product_id,organisation_id),
  FOREIGN KEY(product_id) REFERENCES platform_products(id),
  FOREIGN KEY(organisation_id) REFERENCES organisations(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_entitlement_sync_status
  ON platform_entitlement_sync(status,updated_at DESC);

CREATE TABLE IF NOT EXISTS platform_audit_checkpoints (
  id TEXT PRIMARY KEY,
  previous_checkpoint_hash TEXT,
  checkpoint_hash TEXT NOT NULL UNIQUE,
  first_event_id TEXT,
  last_event_id TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  audit_max_created_at TEXT,
  export_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_checkpoints_created
  ON platform_audit_checkpoints(created_at DESC);

CREATE TABLE IF NOT EXISTS platform_maintenance_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('running','succeeded','failed')),
  checked_products INTEGER NOT NULL DEFAULT 0,
  failed_products INTEGER NOT NULL DEFAULT 0,
  health_rows_deleted INTEGER NOT NULL DEFAULT 0,
  reports_deleted INTEGER NOT NULL DEFAULT 0,
  sessions_deleted INTEGER NOT NULL DEFAULT 0,
  checkpoint_id TEXT,
  error_message TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY(checkpoint_id) REFERENCES platform_audit_checkpoints(id)
);

CREATE INDEX IF NOT EXISTS idx_platform_maintenance_runs_started
  ON platform_maintenance_runs(started_at DESC);

-- The Platform registry is the source of truth for the deployed command centre.
UPDATE platform_products
SET current_version='1.9.0', status='live', updated_at=CURRENT_TIMESTAMP
WHERE code='PLATFORM';
