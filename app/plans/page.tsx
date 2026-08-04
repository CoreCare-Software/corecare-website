import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "Plans", description: "Choose a CoreCare plan shaped around your product, team and operating needs.", alternates: { canonical: "/plans" } };

const plans = [
  { name: "Starter", fit: "For small teams putting one CoreCare product at the centre of their day.", items: ["One CoreCare product", "Guided workspace setup", "Core product support"] },
  { name: "Growing teams", fit: "For established organisations that need broader access and joined-up oversight.", items: ["Flexible users and locations", "Connected operational features", "Implementation support"] },
  { name: "Unlimited", fit: "For larger or more complex organisations that want the fullest CoreCare capability.", items: ["High-capacity access", "Advanced controls and governance", "Tailored implementation"] },
];

export default function PlansPage() { return <MarketingShell><section className="content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Simple commercial journey</p><h1>A clear plan after your free trial.</h1><p className="content-lead">CoreCare pricing is tailored to the product, number of users, locations and implementation needs. We confirm the complete quote before you choose to pay.</p></div></section><section className="section"><div className="site-shell plan-grid">{plans.map((plan) => <article key={plan.name}><p className="eyebrow">{plan.name}</p><h2>Tailored quote</h2><p>{plan.fit}</p><ul>{plan.items.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul><Link className="secondary-button" href={`/contact?subject=${encodeURIComponent(`${plan.name} plan`)}`}>Discuss this plan <Arrow /></Link></article>)}</div><div className="site-shell plan-note"><strong>No automatic charge.</strong><span>A trial can end without payment. A paid subscription begins only after you accept a quote and payment arrangement.</span></div></section><section className="section"><div className="site-shell simple-cta"><div><p className="eyebrow light-eyebrow">Start with the product</p><h2>Try CoreCare for 30 days.</h2><p>No payment card is needed to request a trial.</p></div><Link className="button light-button" href="/trial">Start free trial <Arrow /></Link></div></section></MarketingShell>; }
