# CoreCare product connection audit — 3 August 2026

## Current outcome

Platform, Care, POS, Finance, Garage, and Campsite are deployed in the `Chris Websites` Cloudflare account. All six public health endpoints return HTTP 200, their confirmed production and health addresses are registered in Product Monitor, and Platform now polls product health every five minutes.

The first corrected scheduled poll completed at `2026-08-03 15:55:12 UTC`: all six products were healthy, with response times between 48 ms and 80 ms. Campsite's private heartbeat also reached Platform successfully at `15:55:07 UTC`.

Each product connects privately to Platform through a Cloudflare service binding for support tickets, identity checks, health reports, and single-use support-access exchanges. Separate encrypted product credentials remain in place as an additional application-level check; no credential is stored in a repository.

The source passes 71 automated tests across the six repositories. Every Worker deployment validation passes.

## Live products

| Product | Live version | Live Worker | Persistence | Support and owner access |
| --- | --- | --- | --- | --- |
| Platform | 1.5.0 | `corecare-platform` | Central `corecare` D1 | Central Support Centre, health monitor, ticket ingestion, audited access grants |
| Care | 1.28.1 | `corecare-care` | Central `corecare` D1 | Support Centre and audited organisation support mode |
| POS | 1.3.0 | `corecare-pos` | Dedicated `corecare-pos` D1, migrations 0001–0004 applied | Support page, durable queue/retry, and audited product access |
| Finance | 0.6.0 | `corecare-finance` | Dedicated `corecare-finance` D1, migrations 0001–0004 applied | Support page, durable tickets, and signed product access |
| Garage | 0.7.0 | `corecare-garage` | No full operational product database yet | Authenticated support form and signed product access |
| Campsite | 1.0.0 | `corecare-campsite` | Dedicated `corecare-campsite` D1, migrations 0001–0003 applied | Support Centre, health heartbeat, and audited property-scoped access |

## Access-control boundary

Health reports cannot create or approve organisation access. Product Monitor will only issue a support launch when the link is explicitly marked `ready` and contains a confirmed product-side organisation identifier. A regression test verifies that pending or monitoring-only rows are rejected before a grant is written.

Care already has approved organisation links. No POS, Finance, Garage, or Campsite link was automatically activated during this audit.

## Confirmed product-side identifiers awaiting owner approval

The proposed owner-development mappings are:

- POS: central `org-demo` → new POS tenant `org-demo`; the tenant is created on the first approved support launch.
- Finance: central `org-demo` → existing Finance organisation `demo-corecare-group` (`CoreCare Group`).
- Garage: central `org-demo` → configured Garage tenant `org-demo`.
- Campsite: central `org-demo` → existing property `property-demo` (`Red Lion Campsite`).

These links enable live Platform staff to open those product instances in audited support mode. They require explicit owner approval because an incorrect mapping could expose one organisation's workspace to another.

## Remaining verification after link approval

1. Activate only the approved mappings.
2. Open a read-only session from Platform into each product.
3. Submit a connection-check ticket from each product and confirm it appears in the central inbox.
4. End every test support session and mark the connection-check tickets resolved.
5. Add product databases and durable product-side revocation/audit to Garage before it stores operational customer data.
