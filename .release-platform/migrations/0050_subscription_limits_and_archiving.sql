-- CoreCare commercial plans. Legacy plans remain available to organisations
-- already assigned to them, but are hidden from new sales and onboarding.
INSERT INTO subscription_plans(id,name,monthly_price_pence,max_users,max_clients,max_branches,storage_mb,feature_flags_json,status)
VALUES
  ('limited','Limited',5000,5,15,NULL,2048,'{}','active'),
  ('unlimited','Unlimited',15000,NULL,NULL,NULL,51200,'{}','active')
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name,
  monthly_price_pence=excluded.monthly_price_pence,
  max_users=excluded.max_users,
  max_clients=excluded.max_clients,
  max_branches=excluded.max_branches,
  storage_mb=excluded.storage_mb,
  status=excluded.status,
  updated_at=CURRENT_TIMESTAMP;

UPDATE subscription_plans
SET status='inactive',updated_at=CURRENT_TIMESTAMP
WHERE id IN ('trial','starter','professional','enterprise');

CREATE INDEX IF NOT EXISTS idx_organisations_status_name
  ON organisations(status,name);

CREATE INDEX IF NOT EXISTS idx_users_organisation_status
  ON users(organisation_id,status);

CREATE INDEX IF NOT EXISTS idx_clients_organisation_status
  ON clients(organisation_id,status);

-- Database triggers close the small concurrency gap between checking usage and
-- inserting a record. The Worker performs the same check first so customers get
-- a friendly explanation; these triggers are the final enforcement boundary.
CREATE TRIGGER IF NOT EXISTS enforce_user_subscription_limit_insert
BEFORE INSERT ON users
WHEN NEW.status='active' AND COALESCE(NEW.is_platform_user,0)=0
  AND (SELECT COALESCE(o.max_users,sp.max_users) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id) IS NOT NULL
  AND (SELECT COUNT(*) FROM users u WHERE u.organisation_id=NEW.organisation_id AND u.status='active' AND COALESCE(u.is_platform_user,0)=0) >= (SELECT COALESCE(o.max_users,sp.max_users) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id)
BEGIN
  SELECT RAISE(ABORT,'SUBSCRIPTION_USER_LIMIT');
END;

CREATE TRIGGER IF NOT EXISTS enforce_user_subscription_limit_reactivate
BEFORE UPDATE OF status,organisation_id,is_platform_user ON users
WHEN NEW.status='active' AND COALESCE(NEW.is_platform_user,0)=0 AND (OLD.status<>'active' OR OLD.organisation_id<>NEW.organisation_id OR COALESCE(OLD.is_platform_user,0)<>0)
  AND (SELECT COALESCE(o.max_users,sp.max_users) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id) IS NOT NULL
  AND (SELECT COUNT(*) FROM users u WHERE u.organisation_id=NEW.organisation_id AND u.status='active' AND COALESCE(u.is_platform_user,0)=0 AND u.id<>NEW.id) >= (SELECT COALESCE(o.max_users,sp.max_users) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id)
BEGIN
  SELECT RAISE(ABORT,'SUBSCRIPTION_USER_LIMIT');
END;

CREATE TRIGGER IF NOT EXISTS enforce_client_subscription_limit_insert
BEFORE INSERT ON clients
WHEN NEW.status<>'Archived'
  AND (SELECT COALESCE(o.max_clients,sp.max_clients) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id) IS NOT NULL
  AND (SELECT COUNT(*) FROM clients c WHERE c.organisation_id=NEW.organisation_id AND c.status<>'Archived') >= (SELECT COALESCE(o.max_clients,sp.max_clients) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id)
BEGIN
  SELECT RAISE(ABORT,'SUBSCRIPTION_CLIENT_LIMIT');
END;

CREATE TRIGGER IF NOT EXISTS enforce_client_subscription_limit_restore
BEFORE UPDATE OF status,organisation_id ON clients
WHEN NEW.status<>'Archived' AND (OLD.status='Archived' OR OLD.organisation_id<>NEW.organisation_id)
  AND (SELECT COALESCE(o.max_clients,sp.max_clients) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id) IS NOT NULL
  AND (SELECT COUNT(*) FROM clients c WHERE c.organisation_id=NEW.organisation_id AND c.status<>'Archived' AND c.id<>NEW.id) >= (SELECT COALESCE(o.max_clients,sp.max_clients) FROM organisations o LEFT JOIN subscription_plans sp ON sp.id=o.subscription_plan WHERE o.id=NEW.organisation_id)
BEGIN
  SELECT RAISE(ABORT,'SUBSCRIPTION_CLIENT_LIMIT');
END;
