# CoreCare Platform 1.2.2

## Incident schema repair

- Repairs the legacy `platform_incidents` table so the shared control-centre API can load.
- Stops the global red request-error message appearing on every owners/support portal page.
- Updates the Worker-reported version from the stale 1.1.0 value to 1.2.2.
- Preserves all existing incident records.

Apply migration `0040_repair_platform_incidents_schema.sql` before deploying.
