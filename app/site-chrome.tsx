"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PRODUCTS } from "./products";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return <span className={`brand-lockup${inverse ? " inverse" : ""}`}><span className="brand-mark" aria-hidden="true"><i /><i /></span><span><strong>CoreCare</strong><small>Systems</small></span></span>;
}

export function Arrow() { return <span aria-hidden="true">↗</span>; }

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="site-header"><div className="site-shell nav-shell">
      <Link href="/" aria-label="CoreCare Systems home"><Brand /></Link>
      <button className="menu-button" aria-label="Toggle navigation" aria-expanded={mobileOpen} aria-controls="main-navigation" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? "Close" : "Menu"}</button>
      <nav id="main-navigation" className={mobileOpen ? "open" : ""} aria-label="Main navigation">
        <Link href="/#products" onClick={() => setMobileOpen(false)}>Products</Link>
        <Link href="/#demo" onClick={() => setMobileOpen(false)}>Demonstrations</Link>
        <Link href="/plans" onClick={() => setMobileOpen(false)}>Plans</Link>
        <Link href="/security" onClick={() => setMobileOpen(false)}>Security</Link>
        <Link href="/contact" onClick={() => setMobileOpen(false)}>Contact</Link>
      </nav>
      <div className="nav-actions"><Link className="text-link" href="/login">Log in</Link><Link className="button small-button" href="/trial">Start free trial <Arrow /></Link></div>
    </div></header>
  </>;
}

export function SiteFooter() {
  return <footer><div className="site-shell footer-grid"><div className="footer-brand"><Brand inverse /><p>One connected family of practical business software.</p></div><div><strong>Products</strong>{PRODUCTS.slice(0, 5).map((product) => <Link key={product.code} href={`/products/${product.slug}`}>{product.shortName}</Link>)}</div><div><strong>Get started</strong><Link href="/trial">30-day free trial</Link><Link href="/plans">Plans</Link><Link href="/login">Customer login</Link><Link href="/contact">Book a demonstration</Link></div><div><strong>CoreCare Systems</strong><Link href="/security">Security</Link><Link href="/privacy">Privacy</Link><Link href="/cookies">Cookies</Link><Link href="/terms">Terms</Link><a href="mailto:hello@corecaresystems.co.uk">hello@corecaresystems.co.uk</a><span>United Kingdom</span></div></div><div className="site-shell footer-bottom"><span>© {new Date().getFullYear()} CoreCare Systems</span><span>Built for better working days.</span></div></footer>;
}

export function MarketingShell({ children }: { children: ReactNode }) {
  return <><SiteHeader /><main id="main-content">{children}</main><SiteFooter /></>;
}
