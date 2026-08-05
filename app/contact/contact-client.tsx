"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CUSTOMER_PRODUCTS as PRODUCTS } from "../products";
import { Arrow, MarketingShell } from "../site-chrome";

type ContactResult = { ok?: boolean; error?: string; reference?: string };

export default function ContactClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ContactResult | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setResult(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
      const payload = await response.json() as ContactResult;
      setResult(payload);
      if (payload.ok) event.currentTarget.reset();
    } catch { setResult({ error: "We could not send your enquiry. Please try again." }); }
    finally { setBusy(false); }
  }
  return <MarketingShell><section className="content-hero"><div className="site-shell contact-heading"><div><p className="eyebrow">Talk to CoreCare</p><h1>Show us how your day works.</h1><p className="content-lead">Ask a question or book a tailored demonstration. We will use your information only to respond and arrange the next step.</p></div><div className="contact-direct"><strong>Prefer email?</strong><a href="mailto:hello@corecaresystems.co.uk">hello@corecaresystems.co.uk</a><span>United Kingdom</span></div></div></section><section className="section"><div className="site-shell contact-grid"><form className="contact-form" onSubmit={submit}><input className="form-honeypot" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><div className="trial-form-grid"><label className="form-label">Your name<input name="contactName" autoComplete="name" required /></label><label className="form-label">Work email<input name="email" type="email" autoComplete="email" required /></label><label className="form-label">Organisation<input name="companyName" autoComplete="organization" required /></label><label className="form-label">Product<select name="productCode" defaultValue=""><option value="">General enquiry</option>{PRODUCTS.slice(0, 5).map((product) => <option key={product.code} value={product.code}>{product.name}</option>)}</select></label><label className="form-label wide">How can we help?<textarea name="message" rows={6} required /></label></div><label className="consent-row"><input type="checkbox" name="privacyAccepted" value="yes" required /><span>I have read the <Link href="/privacy">privacy notice</Link> and understand how CoreCare will use this enquiry.</span></label>{result?.error ? <p className="form-message" role="alert" aria-live="assertive">{result.error}</p> : null}{result?.ok ? <p className="form-message success" role="status" aria-live="polite">Thank you. Your enquiry has been saved with reference {result.reference}. We will respond using your work email.</p> : null}<button className="button auth-submit" disabled={busy}>{busy ? "Sending…" : "Send enquiry"} <Arrow /></button></form><aside className="contact-aside"><p className="eyebrow">What happens next</p><ol><li><span>1</span><div><strong>We read the context</strong><p>Your message goes to the CoreCare enquiry queue.</p></div></li><li><span>2</span><div><strong>We arrange the right conversation</strong><p>We focus the demonstration on the product and workflow you need.</p></div></li><li><span>3</span><div><strong>You choose the next step</strong><p>Start a no-card trial, request a quote or leave it there.</p></div></li></ol></aside></div></section></MarketingShell>;
}
