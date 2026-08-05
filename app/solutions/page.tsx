import type { Metadata } from "next";
import Link from "next/link";
import { getProduct } from "../products";
import { SOLUTIONS } from "../solutions-data";
import { Arrow, MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "Business software solutions by sector", description: "Explore practical CoreCare software guidance for care, campsites, garages, hospitality and small-business finance.", alternates: { canonical: "/solutions" } };

export default function SolutionsPage() {
  return <MarketingShell><section className="content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Solutions by sector</p><h1>Start with the work you need to improve.</h1><p className="content-lead">Each guide explains the operating problem, the current product scope and the questions to settle before live use.</p></div></section><section className="section"><div className="site-shell resource-grid">{SOLUTIONS.map((solution, index) => { const product = getProduct(solution.productCode); return <article key={solution.slug}><span>{String(index + 1).padStart(2, "0")} · {product?.name}</span><h2>{solution.title}</h2><p>{solution.description}</p><Link href={`/solutions/${solution.slug}`}>Read the guide <Arrow /></Link></article>; })}</div></section></MarketingShell>;
}
