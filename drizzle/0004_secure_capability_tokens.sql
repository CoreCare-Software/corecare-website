ALTER TABLE trial_requests ADD COLUMN access_token_hash TEXT;
ALTER TABLE trial_requests ADD COLUMN access_token_expires_at TEXT;
ALTER TABLE trial_requests ADD COLUMN automation_token_hash TEXT;
ALTER TABLE trial_requests ADD COLUMN automation_token_ciphertext TEXT;
ALTER TABLE trial_requests ADD COLUMN automation_token_iv TEXT;
ALTER TABLE trial_requests ADD COLUMN automation_token_expires_at TEXT;

UPDATE trial_requests
SET access_token_expires_at = datetime('now', '+120 days')
WHERE access_token IS NOT NULL AND access_token_expires_at IS NULL;

UPDATE trial_requests
SET automation_token_expires_at = datetime('now', '+120 days')
WHERE automation_token IS NOT NULL AND automation_token_expires_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_requests_access_token_hash
ON trial_requests(access_token_hash)
WHERE access_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_trial_requests_automation_token_hash
ON trial_requests(automation_token_hash)
WHERE automation_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trial_requests_access_expiry
ON trial_requests(access_token_expires_at);

ALTER TABLE contact_requests ADD COLUMN automation_token_hash TEXT;
ALTER TABLE contact_requests ADD COLUMN automation_token_expires_at TEXT;

UPDATE contact_requests
SET automation_token_expires_at = datetime('now', '+7 days')
WHERE automation_token IS NOT NULL AND automation_token_expires_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_requests_automation_token_hash
ON contact_requests(automation_token_hash)
WHERE automation_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contact_requests_automation_expiry
ON contact_requests(automation_token_expires_at);

PRAGMA optimize;
