-- CoreCare Platform 1.4.0 — Complete Support Centre
ALTER TABLE platform_support_tickets ADD COLUMN incident_id TEXT;
ALTER TABLE platform_support_tickets ADD COLUMN due_at TEXT;
CREATE TABLE IF NOT EXISTS platform_ticket_attachments (
 id TEXT PRIMARY KEY,
 ticket_id TEXT NOT NULL,
 uploaded_by TEXT,
 file_name TEXT NOT NULL,
 mime_type TEXT,
 size_bytes INTEGER NOT NULL DEFAULT 0,
 data_url TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES platform_support_tickets(id),
 FOREIGN KEY(uploaded_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON platform_ticket_attachments(ticket_id,created_at);
CREATE INDEX IF NOT EXISTS idx_platform_tickets_incident ON platform_support_tickets(incident_id);
