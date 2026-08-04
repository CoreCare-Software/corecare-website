# CoreCare Platform 1.4.3

Fixes HTTP 500 responses from `POST /api/platform/support-sessions` by restoring the missing audit-writing helper used after a support session is created.

The existing `platform_support_sessions`, `support_sessions`, support ticket, and audit data are preserved. No database migration is required.
