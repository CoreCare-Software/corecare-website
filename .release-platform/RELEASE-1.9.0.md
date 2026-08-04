# CoreCare Platform 1.9.0

Production hardening and owner command-centre completion.

## Included

- Complete Platform user lifecycle with last-owner protection, password reset and session revocation.
- Honest Cloudflare Access identity-boundary reporting and server-enforced Platform session policy.
- Product-neutral dashboard and customer-success measures.
- Working Revenue and Notifications destinations.
- Central feature-delivery acknowledgements with version and checksum verification.
- Product and organisation entitlement delivery status in the owner workspace.
- Scheduled retention maintenance, recorded maintenance outcomes and chained audit checkpoints.
- R2-ready private attachment storage with checksum verification and a compatible D1 fallback.
- Clean staging D1 configuration, generated Worker types, migration guards, unit tests and Worker-runtime tests.

## Safe rollout

Migration `0049_platform_resilience_and_governance.sql` is additive. Existing records and stored organisation security settings remain intact. The application labels MFA and trusted-device enforcement as Cloudflare Access responsibilities without rewriting those records. Export production D1 before rollout and retain the prior Worker version for rollback.

Staging must not be published until it has its own Cloudflare Access policy. R2 remains disabled at the Cloudflare account level; attachments continue using D1 until the account owner enables R2 and a private binding is deployed.
