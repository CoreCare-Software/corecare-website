# CoreCare Platform 1.1.0 — Ecosystem Control Plane

Adds the central product registry, software health model, unified support ticket foundation, temporary audited support sessions, incidents, releases and privileged platform-staff overview.

## Deployment
1. Run `npm install`.
2. Run `npm run db:migrate:remote`.
3. Run `npm run deploy`.
4. Open Ecosystem control from the platform navigation.

Health cards initially show seeded connection states. Each CoreCare product will next expose a signed health endpoint so these records can update automatically.
