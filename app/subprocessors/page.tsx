import type { Metadata } from "next";
import { MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "Subprocessors", description: "The subprocessors currently used to host, protect and deliver CoreCare services.", alternates: { canonical: "/subprocessors" } };

export default function SubprocessorsPage() {
  return <MarketingShell><section className="content-hero compact-content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Subprocessors</p><h1>The suppliers behind CoreCare delivery.</h1><p className="content-lead">This list covers suppliers that may process customer personal data for the hosted CoreCare suite. A supplier is included only for the services actually enabled for a customer.</p><p className="updated-note">Last reviewed 5 August 2026</p></div></section><section className="section legal-section"><div className="site-shell legal-copy">
    <div className="legal-table-wrap"><table><thead><tr><th>Supplier</th><th>Purpose</th><th>Data and location notes</th></tr></thead><tbody><tr><td>Cloudflare, Inc. and relevant group entities</td><td>Network delivery and security, Workers application hosting, D1 database, R2 object storage where configured, service observability and identity protection.</td><td>Account, product, technical, security and hosted customer data as required by the enabled service. Cloudflare operates an international network; applicable contractual transfer safeguards are used for restricted transfers.</td></tr></tbody></table></div>
    <h2>Payment and optional integrations</h2><p>A payment processor or another integration is not automatically a Subprocessor for every CoreCare product. Where a customer enables an optional service that processes Customer Personal Data, the applicable order and this list will identify it before production use. CoreCare does not use this page to claim that an unfinished or test integration is live.</p>
    <h2>Changes and objections</h2><p>Customers may subscribe to change notices by emailing <a href="mailto:privacy@corecaresystems.co.uk?subject=Subprocessor%20change%20notices">privacy@corecaresystems.co.uk</a>. CoreCare will give reasonable advance notice of a new or replacement Subprocessor where practicable. A customer may raise a reasonable data-protection objection under the DPA.</p>
  </div></section></MarketingShell>;
}
