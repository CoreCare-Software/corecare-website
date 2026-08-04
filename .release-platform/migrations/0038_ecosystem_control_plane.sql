-- CoreCare Platform 1.1.0 ecosystem control plane
CREATE TABLE IF NOT EXISTS platform_products (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'development',
 current_version TEXT, environment TEXT NOT NULL DEFAULT 'production', repository_url TEXT, cloudflare_project TEXT, production_url TEXT,
 health_url TEXT, support_email TEXT, maintenance_mode INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS platform_product_health (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unknown', response_ms INTEGER, error_count_24h INTEGER NOT NULL DEFAULT 0,
 database_status TEXT, auth_status TEXT, integration_status TEXT, details_json TEXT, last_check_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(product_id) REFERENCES platform_products(id)
);
CREATE TABLE IF NOT EXISTS platform_support_tickets (
 id TEXT PRIMARY KEY, ticket_number TEXT NOT NULL UNIQUE, product_id TEXT, organisation_id TEXT, subject TEXT NOT NULL, description TEXT,
 priority TEXT NOT NULL DEFAULT 'normal', category TEXT NOT NULL DEFAULT 'general', status TEXT NOT NULL DEFAULT 'new', assigned_to TEXT,
 created_by TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT,
 FOREIGN KEY(product_id) REFERENCES platform_products(id), FOREIGN KEY(organisation_id) REFERENCES organisations(id)
);
CREATE TABLE IF NOT EXISTS platform_support_sessions (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL, organisation_id TEXT NOT NULL, staff_user_id TEXT NOT NULL, access_mode TEXT NOT NULL,
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL, ended_at TEXT,
 FOREIGN KEY(product_id) REFERENCES platform_products(id), FOREIGN KEY(organisation_id) REFERENCES organisations(id), FOREIGN KEY(staff_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS platform_incidents (
 id TEXT PRIMARY KEY, product_id TEXT, title TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'minor', status TEXT NOT NULL DEFAULT 'investigating',
 public_message TEXT, internal_notes TEXT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(product_id) REFERENCES platform_products(id)
);
CREATE TABLE IF NOT EXISTS platform_releases (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL, version TEXT NOT NULL, environment TEXT NOT NULL DEFAULT 'production', status TEXT NOT NULL DEFAULT 'deployed',
 commit_sha TEXT, release_notes TEXT, deployed_by TEXT, deployed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(product_id) REFERENCES platform_products(id)
);
CREATE INDEX IF NOT EXISTS idx_platform_health_product ON platform_product_health(product_id,last_check_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_tickets_status ON platform_support_tickets(status,priority,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_status ON platform_support_sessions(status,expires_at);
INSERT OR IGNORE INTO platform_products(id,code,name,description,status,current_version,sort_order) VALUES
 ('product-care','CARE','CoreCare Care','Care management, rostering, eMAR and compliance','live','1.26.0',10),
 ('product-platform','PLATFORM','CoreCare Platform','Owner, developer, support and ecosystem control plane','live','1.1.0',5),
 ('product-pos','POS','CoreCare POS','Hospitality and retail point of sale','development','0.1.0',20),
 ('product-garage','GARAGE','CoreCare Garage','Garage management, workshop and parts platform','development','0.1.0',30),
 ('product-campsite','CAMPSITE','CoreCare Campsite & Leisure','Bookings, channel management and holiday operations','development','0.1.0',40),
 ('product-finance','FINANCE','CoreCare Finance','Accountancy, bookkeeping and financial operations','planning','0.1.0',50);
INSERT OR IGNORE INTO platform_product_health(id,product_id,status,response_ms,error_count_24h,database_status,auth_status,integration_status) VALUES
 ('health-platform-seed','product-platform','healthy',42,0,'healthy','healthy','monitoring'),
 ('health-care-seed','product-care','healthy',61,0,'healthy','healthy','monitoring'),
 ('health-pos-seed','product-pos','development',NULL,0,'not_connected','not_connected','not_connected'),
 ('health-garage-seed','product-garage','development',NULL,0,'not_connected','not_connected','not_connected'),
 ('health-campsite-seed','product-campsite','development',NULL,0,'not_connected','not_connected','not_connected'),
 ('health-finance-seed','product-finance','planning',NULL,0,'not_connected','not_connected','not_connected');
