"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { TRIAL_PRODUCTS } from "../products";

type TrialResult = { ok?: boolean; existing?: boolean; message?: string; error?: string; product?: { name: string }; statusUrl?: string; trial?: { endsAt: string } };

function Brand() { return <span className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span><strong>CoreCare</strong><small>Systems</small></span></span>; }

export default function TrialClient() {
  const [product, setProduct] = useState(TRIAL_PRODUCTS[0].code);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrialResult | null>(null);
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("product")?.toUpperCase(); if (TRIAL_PRODUCTS.some((item) => item.code === value)) setProduct(value as typeof product); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setResult(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/trials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    setResult(await response.json() as TrialResult); setBusy(false);
  }
  return <main className="auth-page"><section className="auth-panel"><Link href="/"><Brand /></Link><div className="auth-form-wrap">
    {result?.ok ? <div className="trial-success-card"><p className="eyebrow">Request received</p><h2>{result.existing ? "Your request is already with us." : "Your 30 days are reserved."}</h2><p>{result.message || `We’ve saved your request for ${result.product?.name}. Your trial period will be confirmed with your workspace access, so you won’t lose setup time.`}</p>{result.statusUrl ? <Link className="button" href={result.statusUrl}>View trial status <span>→</span></Link> : <Link className="button" href="/login">Go to login <span>→</span></Link>}</div> : <><p className="eyebrow">30-day free trial</p><h1>Choose your CoreCare.</h1><p>No card is needed. Tell us where you’d like to begin and we’ll keep the setup and trial dates together.</p><form onSubmit={submit}><input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: "-9999px" }} /><div className="product-choices wide">{TRIAL_PRODUCTS.map((item) => <button type="button" key={item.code} className={`product-choice${product === item.code ? " active" : ""}`} onClick={() => setProduct(item.code)}><i style={{ background: item.soft, color: item.accent }}>{item.icon}</i><strong>{item.shortName}</strong></button>)}</div><input type="hidden" name="productCode" value={product} /><div className="trial-form-grid"><label className="form-label">Your name<input name="contactName" autoComplete="name" required /></label><label className="form-label">Work email<input name="email" type="email" autoComplete="email" required /></label><label className="form-label wide">Organisation<input name="companyName" autoComplete="organization" required /></label><label className="form-label">Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" /></label><label className="form-label">Team size<select name="teamSize" defaultValue=""><option value="">Select</option><option>1–5</option><option>6–20</option><option>21–50</option><option>51–100</option><option>101+</option></select></label></div>{result?.error && <p className="form-message">{result.error}</p>}<button className="button auth-submit" disabled={busy}>{busy ? "Saving your request…" : "Request my free trial"} <span>↗</span></button></form></>}
  </div><Link className="auth-back" href="/">← Back to CoreCare Systems</Link></section><section className="auth-visual"><div className="auth-visual-content"><p className="eyebrow light-eyebrow">Time to explore properly</p><h2>Thirty days.<br />Your real working world.</h2><p>See how CoreCare fits the way your team works, with clear trial dates and no payment card required to begin.</p><div className="auth-product-list">{TRIAL_PRODUCTS.slice(0,4).map((item) => <article key={item.code}><i>{item.icon}</i><strong>{item.name}</strong></article>)}</div></div></section></main>;
}
