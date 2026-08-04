# CoreCare Platform 1.7.3

This release turns the owner Platform Settings and Audit Log screens into working operational tools.

## Platform settings

- Persists owner-controlled operational settings in the existing `platform_settings` D1 table.
- Controls default and maximum audited support-session durations.
- Controls API warning and critical thresholds shown by Platform health monitoring.
- Controls the concurrent support-session warning threshold.
- Controls the default number of records loaded per audit page.
- Restricts changes to the Platform owner and records every save in the audit log.

## Audit log

- Connects the dedicated Audit Log screen to the live audit service.
- Adds search, category filters, time filters, summary totals and paging.
- Displays actor, organisation, entity and safe event details.
- Keeps the existing executive audit table compatible with the enhanced endpoint.

## Verification

- Server and browser JavaScript syntax checks.
- Automated settings validation and support-duration enforcement tests.
- Cloudflare Workers dry-run build before production deployment.
