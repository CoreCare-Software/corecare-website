import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "../../products";
import { getSolution, SOLUTIONS } from "../../solutions-data";
import { Arrow, MarketingShell } from "../../site-chrome";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return SOLUTIONS.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> { const solution = getSolution((await params).slug); return solution ? { title: solution.title, description: solution.description, alternates: { canonical: `/solutions/${solution.slug}` } } : {}; }

export default async function SolutionLandingPage({ params }: Props) {
  const solution = getSolution((await params).slug); if (!solution) notFound();
  const product = getProduct(solution.productCode); if (!product) notFound();
  const schema = { "@context": "https://schema.org", "@type": "WebPage", name: solution.title, description: solution.description, url: `https://www.corecaresystems.co.uk/solutions/${solution.slug}`, about: { "@type": "SoftwareApplication", name: product.name, applicationCategory: "BusinessApplication" } };
  return <MarketingShell><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} /><section className="content-hero product-detail-hero" style={{ "--product-accent": product.accent, "--product-soft": product.soft } as React.CSSProperties}><div className="site-shell narrow-heading"><p className="eyebrow">{product.name}</p><h1>{solution.title}</h1><p className="content-lead">{solution.description}</p><p className="availability-line"><strong>{product.availability}</strong> {product.availabilityDetail}</p><div className="hero-actions"><Link className="button" href={`/demos?product=${product.code}`}>Open representative demo <Arrow /></Link><Link className="secondary-button" href={`/trial?product=${product.code}`}>Request a 30-day trial</Link></div></div></section><section className="section"><div className="site-shell product-story-grid"><div><p className="eyebrow">Who this is for</p><h2>Start with the operating problem.</h2><p>{solution.audience}</p><h3>Common warning signs</h3><ul className="content-list">{solution.challenges.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="feature-stack">{solution.approach.map((item, index) => <article key={item}><span>0{index + 1}</span><div><h3>{item}</h3><p>Confirmed with your team before production reliance.</p></div></article>)}</div></div></section><section className="section process-section"><div className="site-shell faq-grid"><div><p className="eyebrow">Practical questions</p><h2>Know what must be confirmed.</h2><p>Every organisation is different. These answers describe the current public scope, not a hidden promise.</p><Link className="secondary-button" href={`/products/${product.slug}`}>View full product detail <Arrow /></Link></div><div className="faq-list">{solution.questions.map((item, index) => <details key={item.question} open={index === 0}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div></div></section></MarketingShell>;
}
