# CoreCare product integration contract

Every CoreCare product connects to Platform through the same access protocol.

## Product configuration

1. Register the product in CoreCare Platform.
2. Set its production URL. Platform opens `<production URL>/platform-access`.
3. Configure a different strong product key for each product:
   - Platform: `CORECARE_<PRODUCT_CODE>_PRODUCT_KEY`
   - Product: `CORECARE_PRODUCT_KEY`

Keys can alternatively be supplied to Platform as a JSON object in `CORECARE_PRODUCT_KEYS`, keyed by product code.

## Receiving a launch

The product's `/platform-access` page receives two query parameters:

- `code`: a random single-use code that expires after five minutes.
- `platform_origin`: the Platform origin that issued the code.

The product backend must immediately exchange the code server-to-server:

```http
POST <platform_origin>/api/platform/access/exchange
X-CoreCare-Product-Key: <product key>
Content-Type: application/json

{"code":"<code>","product_code":"POS"}
```

The successful response contains the central and product-specific organisation identifiers, platform user identity, access mode, reason, support-session ID and expiry time.

The product must then:

1. Find or provision the organisation using `organisation.external_id`.
2. Create its own short-lived, HTTP-only support session cookie.
3. Enforce the returned access mode on every product API request.
4. Store the Platform support-session ID in its audit records.
5. Redirect the browser from `/platform-access` to the organisation workspace.

The exchange code cannot be reused. Products must never place the product key or the exchanged identity payload in browser storage.

## Product monitoring

Products send health reports to `POST /api/platform/health-ingest` using the shared `X-CoreCare-Health-Key` credential. The body includes `product_code`, the central `organisation_id` when reporting an organisation installation, version, environment, status, and the database/authentication/integration health fields.

## Product support tickets

Connected products submit support tickets directly to `POST /api/platform/product-tickets` using `X-CoreCare-Product-Key`. The JSON body must include `product_code`, the central `organisation_id`, `subject`, and may include `description`, `priority`, `category`, `version`, an external `id`, and `contact.name`/`contact.email`. The product and organisation must already be linked and ready in Platform. The response includes the central `ticketNumber` shown to the customer.

## Feature entitlement delivery

Products fetch the current effective feature state from:

```http
GET /api/platform/organisations/<central organisation id>/products/<product code>/entitlements
X-CoreCare-Product-Key: <product key>
```

The response includes an entitlement `version`, `checksum`, the effective feature list and the delivery state. The product must apply the full effective feature set atomically, persist the version and checksum it applied, and then acknowledge the result:

```http
POST /api/platform/entitlements/acknowledge
X-CoreCare-Product-Key: <product key>
Content-Type: application/json

{
  "product_code": "POS",
  "organisation_id": "org-demo",
  "version": 7,
  "checksum": "<checksum returned by Platform>",
  "status": "applied"
}
```

Use `status: "failed"` with a short `error` value when the product cannot apply the state. Platform rejects stale versions, a mismatched checksum, an unknown organisation mapping and the wrong product credential. Products should retry pending delivery with bounded backoff and must continue enforcing the last successfully applied state until a newer complete state is acknowledged.

Platform displays `pending`, `applied` or `failed` for each organisation/product connection. A Platform save confirms the requested central state; only an `applied` acknowledgement proves that the product has enforced it.
