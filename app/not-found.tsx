import Link from "next/link";
import { MarketingShell } from "./site-chrome";

export default function NotFound() { return <MarketingShell><section className="content-hero not-found-page"><div className="site-shell narrow-heading"><p className="eyebrow">Page not found</p><h1>That route is not part of CoreCare.</h1><p className="content-lead">The address may have changed, or the link may be incomplete.</p><div className="hero-actions"><Link className="button" href="/">Return home</Link><Link className="secondary-button" href="/login">Go to login</Link></div></div></section></MarketingShell>; }
