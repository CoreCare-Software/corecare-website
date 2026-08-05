# CoreCare privacy and security technical standard

## Transport and storage

- Public and authenticated production routes use HTTPS. Responses set HSTS after the hostname has been confirmed for HTTPS-only operation.
- Authentication cookies are `HttpOnly`, `Secure`, scoped to the smallest practical path and assigned an appropriate `SameSite` value.
- D1 and R2 provider encryption is the suite baseline for data at rest. Do not claim customer-managed keys or a storage jurisdiction that is not evidenced by configuration and provider records.
- Secrets belong in Cloudflare secret bindings. Never place passwords, API keys, session tokens or encryption keys in source, D1 audit metadata or ordinary logs.

## Audit

Record successful and rejected authentication, password and permission changes, support entry/exit, customer or organisation administration, exports, privacy actions, retention runs, breach actions and material creates/updates/deletes. Each durable event should include: id, product, scope, actor or service identity, action, entity type/id, outcome, request/correlation id and UTC time. Metadata must be allow-listed and must not contain passwords or full sensitive records.

Product application roles do not receive update or delete routes for audit events. Platform checkpoints protect the central audit stream. Cloudflare Workers Logs are operational telemetry, not the durable customer audit register.

## Retention and rights

Automatic maintenance may delete expired sessions, rate-limit state and other clearly transient security data. Customer content deletion requires a documented rule, customer instruction or approved case, plus a legal-hold check. Every search, export, correction, restriction or deletion for a rights request receives a product action receipt in the central case.

## Breach readiness

Structured errors include a correlation id and safe route name, never the raw request body. Every product must be able to identify its data owner, affected organisation, relevant audit period, deploy version and recovery source. Suspected personal data exposure is escalated into the central breach register immediately.
