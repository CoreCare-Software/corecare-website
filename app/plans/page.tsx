import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, MarketingShell } from "../site-chrome";

export const metadata: Metadata = {
  title: "CoreCare guide pricing and software packages | From £50 per month",
  description: "View CoreCare guide prices and compare plan allowances. Multi-product packages are individually quoted, with greater savings available as more products are combined.",
  alternates: { canonical: "/plans" },
};

const plans = [
  {
    name: "Limited",
    price: "£50",
    fit: "For a smaller team adopting one CoreCare product.",
    items: ["One CoreCare product", "Up to 5 active product users", "Up to 15 active client-type records where that measure applies", "2 GB hosted storage", "Guided workspace setup and core support"],
  },
  {
    name: "Unlimited",
    price: "£150",
    fit: "For a larger organisation that needs the high-capacity entitlement for one product.",
    items: ["One CoreCare product", "No configured active-user or client-record cap", "50 GB hosted storage", "Advanced controls available in the selected product", "Implementation support agreed for the rollout"],
  },
];

const productLimits = [
  ["Care", "5 active product users; 15 active service users; 2 GB", "No configured active-user or service-user cap; 50 GB"],
  ["Campsites", "5 active product users; 15 active guests/current stays; 2 GB", "No configured active-user or guest cap; 50 GB"],
  ["Finance", "5 active product users; one business workspace; 2 GB", "No configured active-user cap; one product workspace; 50 GB"],
  ["Garage", "5 active product users; one workshop workspace; 2 GB", "No configured active-user cap; one product workspace; 50 GB"],
  ["POS", "5 active product users; one hospitality workspace; 2 GB", "No configured active-user cap; one product workspace; 50 GB"],
];

export default function PlansPage() {
  return <MarketingShell>
    <section className="content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">CoreCare guide pricing</p><h1>Clear starting prices, tailored when you combine products.</h1><p className="content-lead">The prices below are standard guide prices for one CoreCare product. Your final price is confirmed in an individual quote. Choose more than one product and we can create a tailored package with substantial savings—the more products you combine, the greater the potential saving. Try any product for 30 days without a card. No VAT is currently added.</p></div></section>
    <section className="section"><div className="site-shell plan-grid">{plans.map((plan) => <article key={plan.name}><p className="eyebrow">{plan.name}</p><h2>{plan.price}<small> / month guide</small></h2><p>{plan.fit}</p><ul>{plan.items.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul><Link className="secondary-button" href="/trial">Start a 30-day trial <Arrow /></Link></article>)}</div><div className="site-shell plan-note"><strong>Combining CoreCare products?</strong><span>Multi-product packages are priced individually around your organisation. Substantial savings are available, with greater potential savings as more products are included. Contact us for your tailored quote.</span></div><div className="site-shell plan-note"><strong>No charge during your trial.</strong><span>No payment card is needed to begin. Paid access starts only after you accept your individual quote, choose a plan and approve secure checkout.</span></div></section>
    <section className="section plan-detail-section"><div className="site-shell legal-copy wide-legal-copy"><p className="eyebrow">Product-by-product limits</p><h2>What the guide plans mean for each product</h2><p>These figures show the standard starting point for one product; your accepted quote confirms the price that applies to your organisation. “Client-type record” means the product’s main active operational subject. It is a service user in Care and an active guest/current stay in Campsites. Finance, Garage and POS use a workspace measure instead because a generic client count would be misleading.</p><div className="legal-table-wrap"><table><thead><tr><th>Product</th><th>Limited — £50/month guide</th><th>Unlimited — £150/month guide</th></tr></thead><tbody>{productLimits.map(([product, limited, unlimited]) => <tr key={product}><td><strong>{product}</strong></td><td>{limited}</td><td>{unlimited}</td></tr>)}</tbody></table></div>
      <h2>What “Unlimited” does and does not mean</h2><p>Unlimited means that the current entitlement has no configured active-user or client-record cap. It does not mean unlimited storage, support hours, locations, hardware, API traffic, external-provider charges, implementation work or third-party integrations. The 50 GB storage allowance, acceptable-use protections and the purchased product still apply. We will confirm unusual volume or integration needs before an order is accepted.</p>
      <h2>Changing or ending a plan</h2><p>You can ask to upgrade for the next billing period. A downgrade is checked first so current users, records and storage are not put outside the new allowance. Monthly cancellation takes effect at the end of the paid billing period unless the accepted order says otherwise. Failed payments receive notice and a chance to correct the problem before access is restricted. Data export and deletion follow the customer terms, DPA and retention policy.</p>
      <h2>Scope and final price before payment</h2><p>Each individual quote and order confirms the products, package saving, final price, workspace, users, implementation, support route, integrations and any product-specific variation. Hardware, card-processing charges, data-cleansing work and third-party services are not included unless expressly stated.</p>
    </div></section>
    <section className="section"><div className="site-shell simple-cta"><div><p className="eyebrow light-eyebrow">Build your CoreCare package</p><h2>Combine more products and unlock greater savings.</h2><p>Tell us which products, users and locations you need. We will provide an individual quote showing your tailored package and savings before a live subscription begins.</p></div><Link className="button light-button" href="/contact">Request a tailored quote <Arrow /></Link></div></section>
  </MarketingShell>;
}
