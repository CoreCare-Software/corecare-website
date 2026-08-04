-- CoreCare Platform 1.8.0 - central owner-controlled feature entitlements.
-- This migration is additive: existing organisations inherit enabled defaults.

CREATE TABLE IF NOT EXISTS platform_product_features (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  default_enabled INTEGER NOT NULL DEFAULT 1 CHECK(default_enabled IN (0,1)),
  mandatory INTEGER NOT NULL DEFAULT 0 CHECK(mandatory IN (0,1)),
  organisation_can_disable INTEGER NOT NULL DEFAULT 0 CHECK(organisation_can_disable IN (0,1)),
  dependencies_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id,feature_key),
  FOREIGN KEY(product_id) REFERENCES platform_products(id)
);

CREATE TABLE IF NOT EXISTS platform_organisation_features (
  product_id TEXT NOT NULL,
  organisation_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'inherit' CHECK(state IN ('inherit','enabled','disabled')),
  organisation_control TEXT NOT NULL DEFAULT 'owner' CHECK(organisation_control IN ('owner','disable_only')),
  reason TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(product_id,organisation_id,feature_key),
  FOREIGN KEY(product_id) REFERENCES platform_products(id),
  FOREIGN KEY(organisation_id) REFERENCES organisations(id),
  FOREIGN KEY(updated_by) REFERENCES users(id),
  FOREIGN KEY(product_id,feature_key) REFERENCES platform_product_features(product_id,feature_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_product_features_catalogue
  ON platform_product_features(product_id,status,sort_order,feature_key);
CREATE INDEX IF NOT EXISTS idx_platform_organisation_features_org
  ON platform_organisation_features(organisation_id,product_id,updated_at DESC);

-- Catalogue keys are taken from the navigation/module definitions in each
-- product repository. Owner control remains the default for every feature.
WITH feature_seed(code,feature_key,name,category,mandatory,sort_order) AS (
  VALUES
    ('CARE','dashboard','Dashboard','Overview',1,10),
    ('CARE','operations','Operations','Operations',0,20),
    ('CARE','clients','Clients','Care management',0,30),
    ('CARE','staff','Staff','Workforce',0,40),
    ('CARE','family','Family portal','Care management',0,50),
    ('CARE','care','Care plans','Care management',0,60),
    ('CARE','medication','Medication and eMAR','Care management',0,70),
    ('CARE','visits','Visits','Operations',0,80),
    ('CARE','rota','Rota','Operations',0,90),
    ('CARE','tasks','Tasks','Operations',0,100),
    ('CARE','incidents','Incidents','Compliance',0,110),
    ('CARE','finance','Finance','Commercial',0,120),
    ('CARE','reports','Reports','Reporting',0,130),
    ('CARE','settings','Settings','Administration',1,140),

    ('POS','dashboard','Dashboard','Overview',1,10),
    ('POS','operations','Operations','Operations',0,20),
    ('POS','till','Till','Sales',0,30),
    ('POS','orders','Orders','Sales',0,40),
    ('POS','tables','Tables','Hospitality',0,50),
    ('POS','kitchen','Kitchen','Hospitality',0,60),
    ('POS','reservations','Reservations','Hospitality',0,70),
    ('POS','customers','Customers','Customers',0,80),
    ('POS','products','Products','Stock',0,90),
    ('POS','stock','Stock','Stock',0,100),
    ('POS','purchasing','Purchasing','Stock',0,110),
    ('POS','staff','Staff','Workforce',0,120),
    ('POS','reports','Reports','Reporting',0,130),
    ('POS','support','Support','Support',1,140),
    ('POS','settings','Settings','Administration',1,150),

    ('GARAGE','dashboard','Dashboard','Overview',1,10),
    ('GARAGE','diary','Diary','Operations',0,20),
    ('GARAGE','jobs','Jobs','Workshop',0,30),
    ('GARAGE','inspections','Inspections','Workshop',0,40),
    ('GARAGE','customers','Customers','Customers',0,50),
    ('GARAGE','vehicles','Vehicles','Customers',0,60),
    ('GARAGE','estimates','Estimates','Commercial',0,70),
    ('GARAGE','invoices','Invoices','Commercial',0,80),
    ('GARAGE','parts','Parts','Stock',0,90),
    ('GARAGE','tyres','Tyres','Stock',0,100),
    ('GARAGE','diagnostics','Diagnostics','Workshop',0,110),
    ('GARAGE','recovery','Recovery','Operations',0,120),
    ('GARAGE','reminders','Reminders','Operations',0,130),
    ('GARAGE','reports','Reports','Reporting',0,140),
    ('GARAGE','ai','AI assistant','Intelligence',0,150),
    ('GARAGE','integrations','Integrations','Administration',0,160),
    ('GARAGE','support','Support','Support',1,170),
    ('GARAGE','settings','Settings','Administration',1,180),

    ('CAMPSITE','dashboard','Dashboard','Overview',1,10),
    ('CAMPSITE','planner','Planner','Bookings',0,20),
    ('CAMPSITE','arrivals','Arrivals','Bookings',0,30),
    ('CAMPSITE','map','Site map','Operations',0,40),
    ('CAMPSITE','bookings','Bookings','Bookings',0,50),
    ('CAMPSITE','guests','Guests','Customers',0,60),
    ('CAMPSITE','units','Units','Operations',0,70),
    ('CAMPSITE','owners','Owners','Customers',0,80),
    ('CAMPSITE','channels','Channels','Distribution',0,90),
    ('CAMPSITE','pricing','Pricing','Commercial',0,100),
    ('CAMPSITE','payments','Payments','Commercial',0,110),
    ('CAMPSITE','housekeeping','Housekeeping','Operations',0,120),
    ('CAMPSITE','maintenance','Maintenance','Operations',0,130),
    ('CAMPSITE','reports','Reports','Reporting',0,140),
    ('CAMPSITE','ai','AI assistant','Intelligence',0,150),
    ('CAMPSITE','support','Support','Support',1,160),
    ('CAMPSITE','settings','Settings','Administration',1,170),

    ('FINANCE','overview','Overview','Overview',1,10),
    ('FINANCE','sales_invoicing','Sales and invoicing','Accounting',0,20),
    ('FINANCE','purchases_bills','Purchases and bills','Accounting',0,30),
    ('FINANCE','banking','Banking','Accounting',0,40),
    ('FINANCE','bookkeeping','Bookkeeping','Accounting',0,50),
    ('FINANCE','payroll_people','Payroll and people','Payroll',0,60),
    ('FINANCE','assets_stock','Assets and stock','Accounting',0,70),
    ('FINANCE','tax_hmrc','Tax and HMRC','Compliance',0,80),
    ('FINANCE','reports','Reports','Reporting',0,90),
    ('FINANCE','businesses','Businesses','Administration',0,100),
    ('FINANCE','support','Support','Support',1,110),
    ('FINANCE','settings','Settings','Administration',1,120)
)
INSERT OR IGNORE INTO platform_product_features
  (id,product_id,feature_key,name,category,mandatory,sort_order)
SELECT
  'feature-' || lower(feature_seed.code) || '-' || feature_seed.feature_key,
  platform_products.id,
  feature_seed.feature_key,
  feature_seed.name,
  feature_seed.category,
  feature_seed.mandatory,
  feature_seed.sort_order
FROM feature_seed
JOIN platform_products ON platform_products.code=feature_seed.code;
