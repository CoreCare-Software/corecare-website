import type { Metadata } from "next";
import Link from "next/link";
import { CUSTOMER_PRODUCTS } from "../products";
import { Arrow, MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "CoreCare product status", description: "Standard product maturity labels and the current status of every customer-facing CoreCare product.", alternates: { canonical: "/product-status" } };

const definitions = [
  ["Live production", "Approved for ordinary production onboarding within the published scope."],
  ["Controlled production launch", "Production use is limited to an agreed customer, scope and readiness plan."],
  ["Private beta", "Early product access for selected testers under explicit beta terms."],
  ["Guided evaluation", "Representative workflows can be explored; production approval is not included."],
  ["In development", "Not currently available for customer evaluation or production use."],
];

export default function ProductStatusPage() {
  return <MarketingShell><section className="content-hero compact-content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Product maturity</p><h1>One status language across the suite.</h1><p className="content-lead">A trial or demonstration shows capability. It does not silently imply that a product is approved for unrestricted production use.</p><p className="updated-note">Last reviewed 5 August 2026</p></div></section>
    <section className="section"><div className="site-shell legal-copy wide-legal-copy"><div className="legal-table-wrap"><table><thead><tr><th>Status</th><th>Definition</th></tr></thead><tbody>{definitions.map(([status, meaning]) => <tr key={status}><td><strong>{status}</strong></td><td>{meaning}</td></tr>)}</tbody></table></div><h2>Current customer-product status</h2><div className="status-product-grid">{CUSTOMER_PRODUCTS.map((product) => <article key={product.code} style={{ "--product-accent": product.accent, "--product-soft": product.soft } as React.CSSProperties}><span className="product-icon">{product.icon}</span><div><h3>{product.name}</h3><strong>{product.availability}</strong><p>{product.availabilityDetail}</p><Link href={`/products/${product.slug}`}>View current capabilities <Arrow /></Link></div></article>)}</div></div></section>
  </MarketingShell>;
}
