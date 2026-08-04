# CoreCare Platform 1.5.0 — Cross-product command centre

Turns Product Monitor into the control plane for current and future CoreCare products.

## Product control

- Register future CoreCare products from Platform.
- Configure product status, version, production URL, health URL and repository URL.
- Select dynamically registered products without hard-coded navigation changes.

## Organisation control

- Create a new central CoreCare organisation for a selected product.
- Link an existing central organisation to another CoreCare product.
- Store the product's tenant or organisation identifier alongside the central CoreCare identity.

## Audited product access

- Validate the selected product-to-organisation connection.
- Require a configured production URL.
- Create a five-minute, single-use launch grant tied to an audited support session.
- Open the product's `/platform-access` receiver in a new browser tab.
- Provide an authenticated server-to-server exchange endpoint for product receivers.
- Revoke unconsumed grants when a support session is ended.

## Database

Apply migrations `0043_product_access_control_plane.sql`, `0044_product_ticket_ingestion.sql`, and `0045_current_product_catalog.sql` before deploying this release.

Product production and health URLs are intentionally not seeded. They must be entered from Product Monitor using each real deployed HTTPS address. Organisation links must likewise use the real product-side tenant or organisation identifier.
