import Link from "next/link";
import { Arrow, MarketingShell } from "./site-chrome";

export default function NotFound() {
  return <MarketingShell><section className="not-found-page"><div className="site-shell narrow-heading"><p className="eyebrow">404 — page not found</p><h1>This page is not part of the current CoreCare site.</h1><p className="content-lead">The address may be old or mistyped. Return to the product suite, use customer login or ask us for help.</p><div className="hero-actions"><Link className="button" href="/">Go to the homepage <Arrow /></Link><Link className="secondary-button" href="/contact">Contact CoreCare</Link></div></div></section></MarketingShell>;
}
