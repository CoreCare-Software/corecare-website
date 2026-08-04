# CoreCare Platform 1.8.0

Central owner-controlled feature entitlements for every connected CoreCare product and organisation.

## Included

- Verified feature catalogues for Care, POS, Garage, Campsite and Finance.
- Product-wide default, mandatory, status and dependency controls.
- Organisation-specific enabled, disabled or inherited settings.
- Optional disable-only delegation, controlled centrally by the owner.
- Reason-required entitlement changes recorded in the Platform audit log.
- Secure product-key authenticated entitlement contract for connected products.
- Effective-state protection for retired products, maintenance mode, inactive organisations and incomplete connections.

## Data safety

Migration `0048_central_feature_entitlements.sql` is additive. Existing organisations inherit enabled product defaults and no existing records are removed or overwritten.
