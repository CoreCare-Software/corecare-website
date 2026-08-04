"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { PRODUCTS } from "../products";
import { Brand } from "../site-chrome";

type ProductChoice = { code: string; name: string };

const OWNER_URL = PRODUCTS.find((item) => item.code === "PLATFORM")?.liveUrl || "/";

export default function LoginClient({ initialProduct = "", initialError = "" }: { initialProduct?: string; initialError?: string }) {
  const validInitial = PRODUCTS.some((item) => item.code === initialProduct.toUpperCase()) ? initialProduct.toUpperCase() : "";
  const [product, setProduct] = useState(validInitial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [directUrl, setDirectUrl] = useState("");
  const [choices, setChoices] = useState<ProductChoice[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const ownerSelected = product === "PLATFORM";

  function handoff(url: string, email: string, password: string) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.hidden = true;
    for (const [name, value] of Object.entries({ email, password, returnTo: "/" })) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setDirectUrl("");
    setChoices([]);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = await response.json() as { ok?: boolean; handoffUrl?: string; error?: string; directUrl?: string; products?: ProductChoice[] };
      if (result.ok && result.handoffUrl) {
        handoff(result.handoffUrl, String(form.get("email") || ""), String(form.get("password") || ""));
        return;
      }
      setMessage(result.error || "We could not sign you in.");
      setDirectUrl(result.directUrl || "");
      setChoices(result.products || []);
    } catch {
      setMessage("We could not reach the CoreCare login service. Please try again.");
    }
    setBusy(false);
  }

  return <main className="auth-page">
    <section className="auth-panel">
      <Link href="/"><Brand /></Link>
      <div className="auth-form-wrap">
        <p className="eyebrow">Your CoreCare account</p>
        <h1>{ownerSelected ? "Owner Platform access." : "Good to see you again."}</h1>
        <p>{ownerSelected ? "The command centre has an additional Cloudflare identity check before the CoreCare account login." : "Use one login page. Your credentials are checked securely by the CoreCare products and you are sent to the valid workspace."}</p>
        {ownerSelected ? <div className="owner-access-panel">
          <p>Your password is not entered on this public website. Continue to the protected Owner Platform and complete both secure checks there.</p>
          <a className="button auth-submit" href={OWNER_URL} referrerPolicy="no-referrer">Continue to Owner Platform <span aria-hidden="true">↗</span></a>
          <button className="secondary-button auth-submit" type="button" onClick={() => setProduct("")}>Use customer login</button>
        </div> : <>
          <form onSubmit={submit}>
            <label className="form-label">Work email<input type="email" name="email" autoComplete="username" required /></label>
            <label className="form-label">Product<select name="productCode" value={product} onChange={(event) => setProduct(event.target.value)}><option value="">Find it from my account</option>{PRODUCTS.filter((item) => item.code !== "PLATFORM").map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
            <label className="form-label">Password<span className="password-field"><input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button></span></label>
            {message ? <div className="form-message" role="alert" aria-live="assertive"><p>{message}</p>{directUrl ? <a href={directUrl}>Open this product’s current login.</a> : null}</div> : null}
            {choices.length ? <fieldset className="login-choices"><legend>Choose a valid workspace</legend>{choices.map((choice) => <button type="button" key={choice.code} onClick={() => { setProduct(choice.code); setMessage("Workspace selected. Continue to sign in."); setChoices([]); }}>{choice.name}<span aria-hidden="true">→</span></button>)}</fieldset> : null}
            <button className="button auth-submit" disabled={busy}>{busy ? "Checking your account…" : "Continue to my product"} <span aria-hidden="true">↗</span></button>
            <div className="form-help"><a href="mailto:support@corecaresystems.co.uk?subject=CoreCare%20login%20help">Forgotten password or need help?</a><span>Never share your password by email.</span></div>
          </form>
          <button className="secondary-button auth-submit" type="button" onClick={() => setProduct("PLATFORM")}>I’m a CoreCare platform owner</button>
        </>}
      </div>
      <Link className="auth-back" href="/">← Back to CoreCare Systems</Link>
    </section>
    <section className="auth-visual"><div className="auth-visual-content"><p className="eyebrow light-eyebrow">One place to begin</p><h2>The right product.<br />Without the hunt.</h2><p>Only a product that accepts your registered credentials can become a login destination.</p><div className="auth-product-list">{PRODUCTS.slice(0, 4).map((item) => <article key={item.code}><i>{item.icon}</i><strong>{item.name}</strong></article>)}</div></div></section>
  </main>;
}
