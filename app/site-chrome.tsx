"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { COMPANY_ADDRESS, COMPANY_DETAILS } from "./company-details";
import { CUSTOMER_PRODUCTS } from "./products";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`brand-lockup${inverse ? " inverse" : ""}`}><span className="brand-mark" aria-hidden="true"><i /><i /></span><span><strong>CoreCare</strong><small>Systems</small></span></span>;
}

export function Arrow() { return <span aria-hidden="true">↗</span>; }

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header"><div className="site-shell nav-shell">
      <Link href="/" aria-label="CoreCare Systems home"><Brand /></Link>
      <button className="menu-button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} aria-controls="main-navigation" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? "Close" : "Menu"}</button>
      <nav id="main-navigation" className={mobileOpen ? "open" : ""} aria-label="Main navigation">
        <Link href="/#products" onClick={() => setMobileOpen(false)}>Products</Link>
        <Link href="/#demo" onClick={() => setMobileOpen(false)}>Demonstrations</Link>
        <Link href="/#implementation" onClick={() => setMobileOpen(false)}>How it works</Link>
        <Link href="/plans" onClick={() => setMobileOpen(false)}>Plans</Link>
        <Link href="/support" onClick={() => setMobileOpen(false)}>Support</Link>
        <Link href="/contact" onClick={() => setMobileOpen(false)}>Contact</Link>
      </nav>
      <div className="nav-actions"><Link className="text-link" href="/login">Log in</Link><Link className="button small-button" href="/trial">Start free trial <Arrow /></Link></div>
    </div></header>
  </>;
}

export function SiteFooter() {
  return <footer><div className="site-shell footer-grid"><div className="footer-brand"><Brand inverse /><p>One family of focused, practical business software.</p><address>{COMPANY_ADDRESS}</address></div><div><strong>Products</strong>{CUSTOMER_PRODUCTS.map((product) => <Link key={product.code} href={`/products/${product.slug}`}>{product.shortName}</Link>)}</div><div><strong>Get started</strong><Link href="/trial">30-day free trial</Link><Link href="/plans">Plans</Link><Link href="/login">Customer login</Link><Link href="/account-help">Account help</Link><Link href="/contact">Book a demonstration</Link></div><div><strong>Trust and legal</strong><Link href="/compliance">Data protection</Link><Link href="/data-rights">Your data rights</Link><Link href="/data-processing-agreement">Customer DPA</Link><Link href="/customer-terms">Customer terms</Link><Link href="/data-retention">Retention</Link><Link href="/subprocessors">Subprocessors</Link><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/terms">Website terms</Link><Link href="/legal">Legal information</Link><a href={`tel:${COMPANY_DETAILS.telephoneHref}`}>{COMPANY_DETAILS.telephoneDisplay}</a><a href="mailto:hello@corecaresystems.co.uk">hello@corecaresystems.co.uk</a></div></div><div className="site-shell footer-bottom"><span>© {new Date().getFullYear()} {COMPANY_DETAILS.legalName}</span><span>Built for better working days.</span></div></footer>;
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return <><SiteHeader /><main id="main-content">{children}</main><SiteFooter /></>;
}
