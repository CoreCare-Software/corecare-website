-- CoreCare Platform 1.3.0 — support ticket and organisation operations
CREATE TABLE IF NOT EXISTS platform_ticket_messages (
 id TEXT PRIMARY KEY,
 ticket_id TEXT NOT NULL,
 author_user_id TEXT,
 message_type TEXT NOT NULL DEFAULT 'customer_reply',
 body TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES platform_support_tickets(id),
 FOREIGN KEY(author_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS platform_ticket_time_entries (
 id TEXT PRIMARY KEY,
 ticket_id TEXT NOT NULL,
 staff_user_id TEXT NOT NULL,
 minutes INTEGER NOT NULL,
 notes TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(ticket_id) REFERENCES platform_support_tickets(id),
 FOREIGN KEY(staff_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS platform_health_reports (
 id TEXT PRIMARY KEY,
 product_id TEXT NOT NULL,
 organisation_id TEXT,
 version TEXT,
 environment TEXT NOT NULL DEFAULT 'production',
 status TEXT NOT NULL DEFAULT 'unknown',
 response_ms INTEGER,
 error_count_24h INTEGER NOT NULL DEFAULT 0,
 database_status TEXT,
 auth_status TEXT,
 integration_status TEXT,
 failed_jobs INTEGER NOT NULL DEFAULT 0,
 details_json TEXT,
 received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(product_id) REFERENCES platform_products(id),
 FOREIGN KEY(organisation_id) REFERENCES organisations(id)
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON platform_ticket_messages(ticket_id,created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_time_ticket ON platform_ticket_time_entries(ticket_id,created_at);
CREATE INDEX IF NOT EXISTS idx_health_reports_product_org ON platform_health_reports(product_id,organisation_id,received_at DESC);
