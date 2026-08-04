import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCTS, getProductBySlug } from "../../products";
import { Arrow, MarketingShell } from "../../site-chrome";

type ProductPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return PRODUCTS.map((product) => ({ slug: product.slug })); }

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: product.name, description: product.description, url: `/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();
  const structuredData = { "@context": "https://schema.org", "@type": "SoftwareApplication", name: product.name, applicationCategory: "BusinessApplication", operatingSystem: "Web", description: product.description, offers: product.trialAvailable ? { "@type": "Offer", price: "0", priceCurrency: "GBP", description: "30-day trial; no payment card required" } : undefined };
  return <MarketingShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <section className="content-hero product-detail-hero" style={{ "--product-accent": product.accent, "--product-soft": product.soft } as React.CSSProperties}><div className="site-shell product-detail-grid"><div><p className="eyebrow">{product.eyebrow}</p><h1>{product.name}</h1><p className="content-lead">{product.description}</p><div className="hero-actions">{product.trialAvailable ? <Link className="button" href={`/trial?product=${product.code}`}>Start a 30-day trial <Arrow /></Link> : <Link className="button" href="/login?product=PLATFORM">Owner login <Arrow /></Link>}<Link className="secondary-button" href="/contact">Book a demonstration</Link></div></div><div className="product-detail-card"><span className="product-icon">{product.icon}</span><small>Representative workspace</small><strong>{product.metric.value}</strong><p>{product.metric.label}</p><em>{product.metric.detail}</em></div></div></section>
    <section className="section"><div className="site-shell product-story-grid"><div><p className="eyebrow">What it brings together</p><h2>A clearer working day.</h2><p>{product.description} The demonstration uses representative information so you can explore the workflow without exposing a customer workspace.</p></div><div className="feature-stack">{product.features.map((feature, index) => <article key={feature}><span>0{index + 1}</span><div><h3>{feature}</h3><p>Keep this work visible, consistent and connected to the rest of the {product.shortName} workspace.</p></div></article>)}</div></div></section>
    <section className="section product-proof-section"><div className="site-shell trust-grid"><article><span>01</span><h3>Secure sessions</h3><p>Each product creates and owns its own session after validating the account.</p></article><article><span>02</span><h3>Focused access</h3><p>Roles and product entitlements keep people inside the work assigned to them.</p></article><article><span>03</span><h3>Connected support</h3><p>CoreCare operational oversight brings product health and support context together.</p></article></div></section>
    <section className="section"><div className="site-shell simple-cta"><div><p className="eyebrow light-eyebrow">See it with your workflow</p><h2>{product.trialAvailable ? `Try ${product.shortName} for 30 days.` : "Open the protected owner workspace."}</h2><p>{product.trialAvailable ? "No payment card is required. Your trial starts when your workspace access is ready." : "Owner Platform access is restricted to authorised CoreCare operators."}</p></div>{product.trialAvailable ? <Link className="button light-button" href={`/trial?product=${product.code}`}>Request your trial <Arrow /></Link> : <Link className="button light-button" href="/login?product=PLATFORM">Log in <Arrow /></Link>}</div></section>
  </MarketingShell>;
}
