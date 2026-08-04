"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PRODUCTS } from "../products";

function Brand() { return <span className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span><strong>CoreCare</strong><small>Systems</small></span></span>; }

export default function LoginClient() {
  const [product, setProduct] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  useEffect(() => { const value = new URLSearchParams(window.location.search).get("product")?.toUpperCase() || ""; if (PRODUCTS.some((item) => item.code === value)) setProduct(value); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setDirectUrl("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    const result = await response.json() as { ok?: boolean; redirect?: string; error?: string; directUrl?: string; products?: string[] };
    if (result.ok && result.redirect) window.location.assign(result.redirect);
    else { setMessage(result.error || "We could not sign you in."); setDirectUrl(result.directUrl || ""); if (result.products?.length) setProduct(result.products[0]); setBusy(false); }
  }
  const ownerSelected = product === "PLATFORM";
  return <main className="auth-page"><section className="auth-panel"><Link href="/"><Brand /></Link><div className="auth-form-wrap"><p className="eyebrow">Your CoreCare account</p><h1>{ownerSelected ? "Owner Platform access." : "Good to see you again."}</h1><p>{ownerSelected ? "Open the protected command centre for CoreCare products, customers and support." : "Use one login page. We’ll use your account and product access to send you to the right workspace."}</p><form onSubmit={submit}><label className="form-label">Work email<input type="email" name="email" autoComplete="username" required /></label>{!ownerSelected && <label className="form-label">Product<select name="productCode" value={product} onChange={(event) => setProduct(event.target.value)}><option value="">Find it from my account</option>{PRODUCTS.filter((item) => item.code !== "PLATFORM").map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>}{ownerSelected ? <input type="hidden" name="productCode" value="PLATFORM" /> : null}<label className="form-label">Password<input type="password" name="password" autoComplete="current-password" required /></label>{message && <p className="form-message">{message}{directUrl && <> <a href={directUrl}>Open this product’s current login.</a></>}</p>}<button className="button auth-submit" disabled={busy}>{busy ? "Checking your account…" : ownerSelected ? "Open Owner Platform" : "Continue to my product"} <span>↗</span></button><div className="form-help"><span>Having trouble signing in?</span><a href="mailto:support@corecaresystems.co.uk">Contact support</a></div></form>{!ownerSelected && <button className="secondary-button auth-submit" type="button" onClick={() => setProduct("PLATFORM")}>I’m a CoreCare platform owner</button>}</div><Link className="auth-back" href="/">← Back to CoreCare Systems</Link></section><section className="auth-visual"><div className="auth-visual-content"><p className="eyebrow light-eyebrow">One place to begin</p><h2>The right product.<br />Without the hunt.</h2><p>Your CoreCare sign-in is designed to recognise your access and direct you to the workspace you need.</p><div className="auth-product-list">{PRODUCTS.slice(0,4).map((item) => <article key={item.code}><i>{item.icon}</i><strong>{item.name}</strong></article>)}</div></div></section></main>;
}
