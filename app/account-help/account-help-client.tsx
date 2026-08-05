"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CUSTOMER_PRODUCTS } from "../products";
import { Arrow, MarketingShell } from "../site-chrome";

type HelpResult = { ok?: boolean; error?: string; reference?: string };

export default function AccountHelpClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HelpResult | null>(null);
  useEffect(() => { if (result) document.getElementById("account-help-message")?.focus(); }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contactName: data.get("contactName"), email: data.get("email"), companyName: data.get("companyName"),
          productCode: data.get("productCode"), privacyAccepted: data.get("privacyAccepted"), website: data.get("website"),
          message: "Account access or password recovery help requested. Verify the requester before discussing any account or changing access.",
        }),
      });
      const payload = await response.json() as HelpResult;
      setResult(payload);
      if (payload.ok) form.reset();
    } catch {
      setResult({ error: "We could not send the request. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return <MarketingShell>
    <section className="content-hero compact-content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Secure account help</p><h1>Get back to the right CoreCare product.</h1><p className="content-lead">Send an access-help request without sharing your password. To protect every account, this page never confirms whether an email address is registered.</p></div></section>
    <section className="section"><div className="site-shell contact-grid"><form className="contact-form" onSubmit={submit} aria-busy={busy}><input className="form-honeypot" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><div className="trial-form-grid"><label className="form-label">Your name<input name="contactName" autoComplete="name" required /></label><label className="form-label">Work email, or the email you use for your business<input name="email" type="email" autoComplete="email" required /></label><label className="form-label">Organisation<input name="companyName" autoComplete="organization" required /></label><label className="form-label">Product<select name="productCode" defaultValue=""><option value="">I am not sure</option>{CUSTOMER_PRODUCTS.map((product) => <option key={product.code} value={product.code}>{product.name}</option>)}</select></label></div><label className="consent-row"><input type="checkbox" name="privacyAccepted" value="yes" required /><span>I have read the <Link href="/privacy">privacy notice</Link> and understand how CoreCare will use this request.</span></label>{result?.error ? <p id="account-help-message" className="form-message" role="alert" aria-live="assertive" tabIndex={-1}>{result.error}</p> : null}{result?.ok ? <p id="account-help-message" className="form-message success" role="status" aria-live="polite" tabIndex={-1}>Request received{result.reference ? ` with reference ${result.reference}` : ""}. If the details match an account, support will contact you using a verified route. We will not ask you to email your password.</p> : null}<button className="button auth-submit" disabled={busy}>{busy ? "Sending request…" : "Request account help"} <Arrow /></button></form><aside className="contact-aside"><p className="eyebrow">How recovery works</p><ol><li><span>1</span><div><strong>We check the request</strong><p>Support compares the details with the product records without disclosing account information.</p></div></li><li><span>2</span><div><strong>We verify the person</strong><p>We may contact an authorised organisation administrator before changing access.</p></div></li><li><span>3</span><div><strong>We provide a safe route</strong><p>Instructions are sent through an appropriate verified channel. Passwords are never requested by email.</p></div></li></ol><p><strong>Urgent security concern?</strong><br /><a href="mailto:security@corecaresystems.co.uk">security@corecaresystems.co.uk</a></p></aside></div></section>
  </MarketingShell>;
}
