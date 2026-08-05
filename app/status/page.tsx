import type { Metadata } from "next";
import { CUSTOMER_PRODUCTS } from "../products";
import { MarketingShell } from "../site-chrome";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "CoreCare service status", description: "Current reachability checks and incident communication information for customer-facing CoreCare services.", alternates: { canonical: "/status" } };

async function checkProduct(product: (typeof CUSTOMER_PRODUCTS)[number]) {
  try {
    const response = await fetch(`${product.liveUrl}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(5_000), headers: { accept: "application/json", "user-agent": "CoreCare-Status/1.0" } });
    return { product, state: response.ok ? "Available" : "Degraded or unavailable" };
  } catch {
    return { product, state: "Status check unavailable" };
  }
}

export default async function StatusPage() {
  const results = await Promise.all(CUSTOMER_PRODUCTS.map(checkProduct));
  const checkedAt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date());
  return <MarketingShell><section className="content-hero compact-content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Service status</p><h1>Customer service reachability.</h1><p className="content-lead">These checks show whether each public product health endpoint responded when this page was loaded. They are not an uptime guarantee or a substitute for an agreed service level.</p><p className="updated-note">Checked {checkedAt}</p></div></section>
    <section className="section"><div className="site-shell status-overview"><div className="status-product-grid">{results.map(({ product, state }) => <article key={product.code} style={{ "--product-accent": product.accent, "--product-soft": product.soft } as React.CSSProperties}><span className="product-icon">{product.icon}</span><div><h2>{product.name}</h2><p className={`service-state ${state === "Available" ? "service-state-ok" : "service-state-unknown"}`}>{state}</p><small>Health endpoint check only</small></div></article>)}</div><div className="evidence-grid status-guidance"><article><p className="eyebrow">Report an incident</p><h2>Tell us what is affected.</h2><p>Existing customers should use their agreed support route and include the product, time, affected workflow and a safe description. Do not send passwords or sensitive records by ordinary email.</p><a href="mailto:security@corecaresystems.co.uk?subject=Possible%20service%20or%20security%20incident">security@corecaresystems.co.uk</a></article><article><p className="eyebrow">Incident communication</p><h2>Scope before certainty.</h2><p>Confirmed service incidents are communicated through the affected customer support route. Planned maintenance, recovery objectives and emergency cover follow the accepted order. A public incident-history feed will be added when production service monitoring is mature enough to support it.</p></article></div></div></section>
  </MarketingShell>;
}
