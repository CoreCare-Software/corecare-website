import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "Plans", description: "Choose a clear monthly CoreCare plan after your 30-day free trial.", alternates: { canonical: "/plans" } };

const plans = [
  { name: "Limited", price: "£50", fit: "For smaller teams putting one CoreCare product at the centre of their day.", items: ["One CoreCare product", "Up to the plan’s user and client limits", "Guided workspace setup", "Core product support"] },
  { name: "Unlimited", price: "£150", fit: "For larger or more complex organisations that need high-capacity access.", items: ["One CoreCare product", "High-capacity users and records", "Advanced controls and governance", "Implementation support"] },
];

export default function PlansPage() {
  return <MarketingShell>
    <section className="content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Simple commercial journey</p><h1>A clear plan after your free trial.</h1><p className="content-lead">Try any CoreCare product for 30 days. When the trial ends, choose a monthly plan through secure checkout or speak with us if your setup needs something more specific.</p></div></section>
    <section className="section"><div className="site-shell plan-grid">{plans.map((plan) => <article key={plan.name}><p className="eyebrow">{plan.name}</p><h2>{plan.price}<small> / month</small></h2><p>{plan.fit}</p><ul>{plan.items.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul><Link className="secondary-button" href="/trial">Start a 30-day trial <Arrow /></Link></article>)}</div><div className="site-shell plan-note"><strong>No charge during your trial.</strong><span>No payment card is needed to begin. When the 30-day trial ends, access pauses until you choose a monthly plan and complete secure live checkout through Stripe.</span></div></section>
    <section className="section"><div className="site-shell simple-cta"><div><p className="eyebrow light-eyebrow">Need a tailored setup?</p><h2>Talk through users, locations and implementation.</h2><p>We can confirm any bespoke requirements before a live subscription begins.</p></div><Link className="button light-button" href="/contact">Contact CoreCare <Arrow /></Link></div></section>
  </MarketingShell>;
}
