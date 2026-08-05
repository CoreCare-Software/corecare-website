import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PRODUCT_DETAILS } from "../../product-details";
import { CUSTOMER_PRODUCTS, getProductBySlug } from "../../products";
import { Arrow, MarketingShell } from "../../site-chrome";

type ProductPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() { return CUSTOMER_PRODUCTS.map((product) => ({ slug: product.slug })); }

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = getProductBySlug((await params).slug);
  if (!product) return {};
  const detail = PRODUCT_DETAILS[product.code];
  return {
    title: detail.seoTitle,
    description: `${detail.audience} Explore ${product.name} and request a guided 30-day trial.`,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: { title: detail.seoTitle, description: detail.audience, url: `/products/${product.slug}` },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = getProductBySlug((await params).slug);
  if (!product) notFound();
  const detail = PRODUCT_DETAILS[product.code];
  const baseUrl = "https://www.corecaresystems.co.uk";
  const structuredData = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: product.name,
      applicationCategory: "BusinessApplication", operatingSystem: "Web", description: detail.audience,
      url: `${baseUrl}/products/${product.slug}`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "GBP", description: "Guided 30-day trial; no payment card required" },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
        { "@type": "ListItem", position: 2, name: "Products", item: `${baseUrl}/#products` },
        { "@type": "ListItem", position: 3, name: product.name, item: `${baseUrl}/products/${product.slug}` },
      ],
    },
    {
      "@context": "https://schema.org", "@type": "FAQPage", mainEntity: detail.faqs.map((faq) => ({
        "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];

  return <MarketingShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    <section className="content-hero product-detail-hero" style={{ "--product-accent": product.accent, "--product-soft": product.soft } as React.CSSProperties}>
      <div className="site-shell product-detail-grid"><div><p className="eyebrow">{product.eyebrow}</p><h1>{product.name}</h1><p className="content-lead">{detail.audience}</p><p className="availability-line"><strong>{product.availability}</strong> {product.availabilityDetail}</p><div className="hero-actions"><Link className="button" href={`/demos?product=${product.code}`}>Open visual demo <Arrow /></Link><Link className="secondary-button" href={`/trial?product=${product.code}`}>Request a 30-day trial</Link><Link className="secondary-button" href="/contact">Book a demonstration</Link></div></div><div className="product-detail-card" role="img" aria-label={`Representative ${product.name} workspace showing ${product.metric.label}: ${product.metric.value}`}><span className="product-icon">{product.icon}</span><small>Representative workspace</small><strong>{product.metric.value}</strong><p>{product.metric.label}</p><em>{product.metric.detail}</em></div></div>
    </section>

    <section className="section"><div className="site-shell product-story-grid"><div><p className="eyebrow">Built for the work</p><h2>Less chasing. More operational clarity.</h2><p>{detail.overview}</p><h3>Common problems it is designed to address</h3><ul className="content-list">{detail.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul></div><div className="feature-stack">{detail.modules.map((module, index) => <article key={module.name}><span>0{index + 1}</span><div><h3>{module.name}</h3><p>{module.description}</p></div></article>)}</div></div></section>

    <section className="section process-section"><div className="site-shell"><div className="section-heading split-heading"><div><p className="eyebrow">A working day</p><h2>From first action to clear follow-up.</h2></div><p>The exact configuration follows your roles and process. This is the representative flow used in a guided demonstration.</p></div><div className="process-grid">{detail.workflows.map((workflow, index) => <article key={workflow.title}><span>0{index + 1}</span><h3>{workflow.title}</h3><p>{workflow.description}</p></article>)}</div></div></section>

    <section className="section product-evidence-section"><div className="site-shell evidence-grid"><article><p className="eyebrow">Reporting views</p><h2>See what needs attention.</h2><ul className="content-list">{detail.reports.map((report) => <li key={report}>{report}</li>)}</ul></article><article><p className="eyebrow">Confirm before live use</p><h2>No hidden assumptions.</h2><p>These items are checked and agreed during onboarding:</p><ul className="content-list warning-list">{detail.confirmBeforeLive.map((item) => <li key={item}>{item}</li>)}</ul></article></div></section>

    <section className="section"><div className="site-shell"><div className="section-heading centered-heading"><p className="eyebrow">Implementation</p><h2>A guided route from trial to readiness.</h2><p>A trial is an evaluation workspace. Moving real operations into CoreCare happens only after an agreed readiness review.</p></div><ol className="onboarding-grid">{detail.onboarding.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></div></section>

    <section className="section product-proof-section"><div className="site-shell trust-grid"><article><span>01</span><h3>Representative trial data</h3><p>Explore the workflow without exposing a customer workspace or introducing sensitive production records.</p></article><article><span>02</span><h3>Product-owned sessions</h3><p>Each product validates its registered accounts and creates its own separate session.</p></article><article><span>03</span><h3>Scope confirmed in writing</h3><p>Migration, integrations, support and production requirements are agreed before live use.</p></article></div></section>

    <section className="section faq-section"><div className="site-shell faq-grid"><div><p className="eyebrow">{product.shortName} questions</p><h2>What to confirm before you begin.</h2><p>Tell us how your team works and we will answer against your actual setup.</p><Link className="secondary-button" href="/contact">Ask a question <Arrow /></Link></div><div className="faq-list">{detail.faqs.map((faq, index) => <details key={faq.question} open={index === 0}><summary>{faq.question}<span>+</span></summary><p>{faq.answer}</p></details>)}</div></div></section>

    <section className="section"><div className="site-shell simple-cta"><div><p className="eyebrow light-eyebrow">See it with your workflow</p><h2>Explore {product.shortName} for 30 days.</h2><p>No payment card is required. We prepare a representative workspace and activate the trial when it is ready.</p></div><Link className="button light-button" href={`/trial?product=${product.code}`}>Request your trial <Arrow /></Link></div></section>
  </MarketingShell>;
}
