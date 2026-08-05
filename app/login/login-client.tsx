"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { CUSTOMER_PRODUCTS } from "../products";
import { Brand } from "../site-chrome";
import { TurnstileWidget, type TurnstileHandle } from "../turnstile-widget";

type ProductChoice = { code: string; name: string; handoffUrl?: string; grant?: string };

export default function LoginClient({ initialProduct = "", initialError = "" }: { initialProduct?: string; initialError?: string }) {
  const validInitial = CUSTOMER_PRODUCTS.some((item) => item.code === initialProduct.toUpperCase()) ? initialProduct.toUpperCase() : "";
  const [product, setProduct] = useState(validInitial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [directUrl, setDirectUrl] = useState("");
  const [choices, setChoices] = useState<ProductChoice[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);

  function handoff(url: string, grant: string) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = url;
    form.hidden = true;
    for (const [name, value] of Object.entries({ grant, returnTo: "/" })) {
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
    if (!turnstileToken) {
      setMessage("Complete the security verification and try again.");
      return;
    }
    setBusy(true);
    setMessage("");
    setDirectUrl("");
    setChoices([]);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form.entries()), turnstileToken }),
      });
      const result = await response.json() as { ok?: boolean; handoffUrl?: string; grant?: string; error?: string; directUrl?: string; products?: ProductChoice[] };
      if (result.ok && result.handoffUrl && result.grant) {
        handoff(result.handoffUrl, result.grant);
        return;
      }
      setMessage(result.error || "We could not sign you in.");
      setDirectUrl(result.directUrl || "");
      setChoices(result.products || []);
    } catch {
      setMessage("We could not reach the CoreCare login service. Please try again.");
    } finally {
      turnstile.current?.reset();
      setBusy(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-panel">
      <Link href="/"><Brand /></Link>
      <div className="auth-form-wrap">
        <p className="eyebrow">Your CoreCare account</p>
        <h1>Good to see you again.</h1>
        <p>Use one login page. Your credentials are checked securely by the CoreCare products and you are sent to the valid workspace.</p>
          <form onSubmit={submit}>
            <label className="form-label">Email address<input type="email" name="email" autoComplete="username" required /></label>
            <label className="form-label">Product<select name="productCode" value={product} onChange={(event) => setProduct(event.target.value)}><option value="">Find it from my account</option>{CUSTOMER_PRODUCTS.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
            <label className="form-label">Password<span className="password-field"><input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" aria-describedby={capsLock ? "caps-lock-note" : undefined} onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))} onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))} onBlur={() => setCapsLock(false)} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? "Hide" : "Show"}</button></span>{capsLock ? <small id="caps-lock-note" className="field-note" role="status">Caps Lock is on.</small> : null}</label>
            <TurnstileWidget ref={turnstile} action="login" onToken={setTurnstileToken} />
            {message ? <div className="form-message" role="alert" aria-live="assertive"><p>{message}</p>{directUrl ? <a href={directUrl}>Open this product’s current login.</a> : null}</div> : null}
            {choices.length ? <fieldset className="login-choices"><legend>Choose a valid workspace</legend>{choices.map((choice) => <button type="button" key={choice.code} onClick={(event) => {
              const loginForm = event.currentTarget.form;
              if (choice.handoffUrl && choice.grant && loginForm) {
                handoff(choice.handoffUrl, choice.grant);
                return;
              }
              setProduct(choice.code);
              setMessage("Workspace selected. Continue to sign in.");
              setChoices([]);
            }}>{choice.name}<span aria-hidden="true">→</span></button>)}</fieldset> : null}
            <button className="button auth-submit" disabled={busy || !turnstileToken}>{busy ? "Checking your account…" : "Continue to my product"} <span aria-hidden="true">↗</span></button>
            <div className="form-help"><Link href="/account-help">Forgotten password or need help?</Link><span>Never share your password by email.</span></div>
          </form>
      </div>
      <Link className="auth-back" href="/">← Back to CoreCare Systems</Link>
    </section>
    <section className="auth-visual"><div className="auth-visual-content"><p className="eyebrow light-eyebrow">One place to begin</p><h2>The right product.<br />Without the hunt.</h2><p>Only a product that accepts your registered credentials can become a login destination.</p><div className="auth-product-list">{CUSTOMER_PRODUCTS.map((item) => <article key={item.code}><i>{item.icon}</i><strong>{item.name}</strong></article>)}</div></div></section>
  </main>;
}
