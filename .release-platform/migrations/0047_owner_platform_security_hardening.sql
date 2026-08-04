-- CoreCare Platform 1.7.0 security hardening.
-- Expire stale access state and shorten the owner workspace session policy.

UPDATE platform_access_grants
SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
WHERE consumed_at IS NULL
  AND revoked_at IS NULL
  AND (
    datetime(expires_at) <= CURRENT_TIMESTAMP
    OR support_session_id IN (
      SELECT id FROM platform_support_sessions
      WHERE status = 'active' AND datetime(expires_at) <= CURRENT_TIMESTAMP
    )
  );

UPDATE platform_support_sessions
SET status = 'expired', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
WHERE status = 'active' AND datetime(expires_at) <= CURRENT_TIMESTAMP;

DELETE FROM sessions WHERE datetime(expires_at) <= CURRENT_TIMESTAMP;

UPDATE organisation_security_policies
SET session_hours = 8,
    idle_timeout_minutes = 30,
    updated_at = CURRENT_TIMESTAMP
WHERE organisation_id IN (
  SELECT DISTINCT organisation_id
  FROM users
  WHERE is_platform_user = 1 OR access_level IN ('platform_owner','platform_admin')
);
