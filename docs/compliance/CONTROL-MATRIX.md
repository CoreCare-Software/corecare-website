# CoreCare data protection control matrix

Owner: CoreCare Systems owner  
Review cycle: annually and after any material product, provider or legal change  
Current version: 2026-08-05

This matrix is the canonical placement model for the CoreCare suite. Public statements must describe controls actually in service. Product documentation may link to this model but must not create conflicting retention periods or legal terms.

| Control | System of record | Public/customer evidence | Product responsibility |
| --- | --- | --- | --- |
| Controller privacy notice | CoreCare website | `/privacy` | Link from login, help and data-entry contexts where needed |
| Customer processor terms | Customer order plus website DPA | `/data-processing-agreement` | Follow documented controller instructions |
| Customer service terms | Customer order | `/customer-terms` | Enforce only features, access and limits in the order |
| Cookies and local storage | CoreCare website and each product | `/cookies` and product sign-in notice | Inventory every cookie; no optional cookie before consent |
| Retention schedule | Owner Platform compliance register | `/data-retention` | Apply customer-specific rules; log review/export/deletion actions |
| Data subject rights | Owner Platform `privacy_requests` register | `/data-rights` | Search, export, correct, restrict or delete within the assigned task |
| Personal data breaches | Owner Platform `personal_data_breaches` register | Security control statement | Record every suspected breach; preserve product evidence |
| Encryption in transit/at rest | Cloudflare configuration and product response controls | `/security` and DPA | HTTPS, Secure cookies, provider encryption, no unsupported residency claim |
| Audit evidence | Product audit tables plus Platform audit checkpoints | `/security` and customer due diligence | Record authentication, support and material mutations without secrets |
| Subprocessors and transfers | Owner supplier register | `/subprocessors` | Do not enable an undeclared processor for Customer Personal Data |

## Audit result recorded on 5 August 2026

- CoreCare Platform and CoreCare Care already have broad durable audit tables. Platform additionally creates hash-linked audit checkpoints and can export them to R2.
- CoreCare POS has an application audit table and records main catalogue, order, payment and kitchen changes.
- CoreCare Campsite has authentication and Platform-access audit records, but did not have one general mutation register.
- CoreCare Finance has Platform/support/authentication audit events, but the business interface is still described in source as provisional and does not yet demonstrate a complete ledger audit trail.
- CoreCare Garage delegates authentication to Platform and had security response headers, but did not have a general application audit table.
- The public website had enquiry/trial records and service analytics, but no dedicated privacy-rights register.
- All production products use Cloudflare Workers and D1; CoreCare Care and Platform also configure R2. Provider-managed encryption covers D1/R2 at rest and TLS protects supported transport. Existing D1 jurisdiction settings were not evidenced by source, so no UK-only location claim is permitted.
- A single documented retention schedule, central rights workflow and personal-data-breach register were not present across the suite before this compliance release.

## Release gate

Before production customer data is accepted, the owner must confirm the customer order, DPA, controller/processor roles, product retention schedule, data-location requirements, support access, export/deletion method and any sector-specific control. CoreCare Care requires an additional special-category data and safeguarding review.
