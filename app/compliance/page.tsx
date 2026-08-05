import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "Data protection and compliance", description: "CoreCare Systems privacy, data-processing, retention, security and rights information.", alternates: { canonical: "/compliance" } };

const resources = [
  ["Privacy notice", "How CoreCare uses personal information when it acts as controller or processor.", "/privacy"],
  ["Data processing agreement", "The UK GDPR Article 28 terms and processing schedule for customer product data.", "/data-processing-agreement"],
  ["Customer terms", "The service terms that apply when they are incorporated into a customer order.", "/customer-terms"],
  ["Retention policy", "Default review periods, deletion approach, legal holds and customer-controlled retention.", "/data-retention"],
  ["Your data rights", "The tracked route for access, correction, erasure and other privacy requests.", "/data-rights"],
  ["Security", "Current technical and organisational safeguards and responsible disclosure.", "/security"],
  ["Cookie notice", "The essential cookies and service events used by the website and products.", "/cookies"],
  ["Subprocessors", "The suppliers used to deliver and protect CoreCare services.", "/subprocessors"],
] as const;

export default function CompliancePage() {
  return <MarketingShell><section className="content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Data protection</p><h1>Clear responsibilities and accountable records.</h1><p className="content-lead">CoreCare publishes one set of customer-facing documents for the suite. Privacy cases and breach records are coordinated through restricted internal registers, while each product keeps the operational evidence relevant to that service.</p><p className="updated-note">Compliance library reviewed 5 August 2026</p></div></section>
    <section className="section trust-section"><div className="site-shell"><div className="resource-grid">{resources.map(([title, text, href], index) => <article key={href}><span>{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{text}</p><Link href={href}>Open resource <Arrow /></Link></article>)}</div></div></section>
    <section className="section"><div className="site-shell evidence-grid"><article><p className="eyebrow">Controller and processor roles</p><h2>The role follows the data.</h2><p>CoreCare is controller for its own website, sales, account, security and business administration information. A subscribing organisation is normally controller for the records it enters into a CoreCare product, and CoreCare acts as its processor under the data processing agreement.</p></article><article><p className="eyebrow">Questions and evidence</p><h2>Ask for what you need.</h2><p>Customers can request the current control statement, processing schedule, subprocessor information and assistance with a rights request or data incident from <a href="mailto:privacy@corecaresystems.co.uk">privacy@corecaresystems.co.uk</a>.</p></article></div></section>
  </MarketingShell>;
}
