"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { CUSTOMER_PRODUCTS } from "../products";
import { Brand } from "../site-chrome";
import { TurnstileWidget, type TurnstileHandle } from "../turnstile-widget";

type ProductChoice = {
  code: string;
  name: string;
  description?: string;
  handoffUrl: string;
  grant: string;
  returnTo?: string;
};

type MfaStep = {
  challengeToken?: string;
  enrollmentRequired?: boolean;
  secret?: string;
  otpAuthUri?: string;
  expiresAt?: string;
};

type SetupStep = {
  grant: string;
  expiresAt?: string;
};

type AuthResult = {
  ok?: boolean;
  stage?: string;
  error?: string;
  code?: string;
  mfa?: MfaStep;
  setup?: SetupStep;
  handoff?: ProductChoice;
  products?: ProductChoice[];
  choices?: ProductChoice[];
  recoveryCodes?: string[];
};

export default function LoginClient({
  initialProduct = "",
  initialError = "",
}: {
  initialProduct?: string;
  initialError?: string;
}) {
  const validInitial = CUSTOMER_PRODUCTS.some((item) => item.code === initialProduct.toUpperCase())
    ? initialProduct.toUpperCase()
    : "";
  const [product, setProduct] = useState(validInitial);
  const [stage, setStage] = useState("credentials");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [choices, setChoices] = useState<ProductChoice[]>([]);
  const [mfa, setMfa] = useState<MfaStep | null>(null);
  const [setup, setSetup] = useState<SetupStep | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingResult, setPendingResult] = useState<AuthResult | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);

  function handoff(choice: ProductChoice) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = choice.handoffUrl;
    form.hidden = true;
    for (const [name, value] of Object.entries({
      grant: choice.grant,
      returnTo: choice.returnTo || "/",
    })) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
  }

  function continueWith(result: AuthResult, newRecoveryCodes: string[] = []) {
    if (result.stage === "mfa" && result.mfa) {
      setMfa(result.mfa);
      setStage("mfa");
      return;
    }
    if (result.stage === "password" && result.setup) {
      setSetup(result.setup);
      if (newRecoveryCodes.length) setRecoveryCodes(newRecoveryCodes);
      setStage("password");
      return;
    }
    const nextChoices = result.products || result.choices || [];
    if (newRecoveryCodes.length) {
      setRecoveryCodes(newRecoveryCodes);
      setPendingResult(result);
      setStage("recovery");
      return;
    }
    if (result.handoff) {
      handoff(result.handoff);
      return;
    }
    if (nextChoices.length) {
      setChoices(nextChoices);
      setStage("products");
      return;
    }
    setMessage(result.error || "This account does not currently have an available CoreCare product.");
  }

  async function request(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as AuthResult;
    if (!response.ok && !result.stage) {
      throw new Error(result.error || "We could not complete this security step.");
    }
    return result;
  }

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turnstileToken) {
      setMessage("Complete the security verification and try again.");
      return;
    }
    setBusy(true);
    setMessage("");
    setChoices([]);
    const form = new FormData(event.currentTarget);
    try {
      continueWith(await request("/api/login", {
        ...Object.fromEntries(form.entries()),
        turnstileToken,
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not reach the CoreCare login service.");
    } finally {
      turnstile.current?.reset();
      setTurnstileToken("");
      setBusy(false);
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await request("/api/login/mfa", {
        challengeToken: mfa?.challengeToken,
        code: form.get("code"),
        requestedProduct: product,
      });
      continueWith(result, result.recoveryCodes || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Authenticator code could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password !== confirmation) {
      setMessage("The new passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await request("/api/login/password", {
        grant: setup?.grant,
        newPassword: password,
      });
      if (recoveryCodes.length) {
        setPendingResult(result);
        setStage("recovery");
      } else {
        continueWith(result);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/"><Brand /></Link>
        <div className="auth-form-wrap">
          <p className="eyebrow">Your CoreCare account</p>
          <h1>
            {stage === "credentials"
              ? "Good to see you again."
              : stage === "mfa"
                ? "Secure your account."
                : stage === "password"
                  ? "Choose your private password."
                  : stage === "recovery"
                    ? "Save your recovery codes."
                    : "Choose your product."}
          </h1>

          {stage === "credentials" ? (
            <>
              <p>Sign in once. CoreCare will show only the products assigned to you.</p>
              <form method="post" action="/api/login" onSubmit={submitCredentials}>
                <label className="form-label">
                  Email address
                  <input type="email" name="email" autoComplete="username" required />
                </label>
                <label className="form-label">
                  Product
                  <select name="productCode" value={product} onChange={(event) => setProduct(event.target.value)}>
                    <option value="">Show all my products</option>
                    {CUSTOMER_PRODUCTS.map((item) => (
                      <option key={item.code} value={item.code}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Password
                  <span className="password-field">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      aria-describedby={capsLock ? "caps-lock-note" : undefined}
                      onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                      onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                      onBlur={() => setCapsLock(false)}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                  {capsLock ? <small id="caps-lock-note" className="field-note" role="status">Caps Lock is on.</small> : null}
                </label>
                <TurnstileWidget ref={turnstile} action="login" onToken={setTurnstileToken} />
                <button className="button auth-submit" disabled={busy || !turnstileToken}>
                  {busy ? "Checking your account..." : "Continue securely"}
                </button>
              </form>
            </>
          ) : null}

          {stage === "mfa" ? (
            <>
              <p>
                {mfa?.enrollmentRequired
                  ? "Add CoreCare to Microsoft Authenticator or another TOTP app, then enter the current six-digit code."
                  : "Enter the current code from your Authenticator app."}
              </p>
              {mfa?.enrollmentRequired ? (
                <div className="auth-setup-card">
                  <strong>Authenticator setup key</strong>
                  <code>{mfa.secret}</code>
                  {mfa.otpAuthUri ? <a href={mfa.otpAuthUri}>Open in Authenticator</a> : null}
                </div>
              ) : null}
              <form onSubmit={submitMfa}>
                <label className="form-label">
                  Six-digit code
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                  />
                </label>
                <button className="button auth-submit" disabled={busy}>
                  {busy ? "Verifying..." : "Verify Authenticator"}
                </button>
              </form>
            </>
          ) : null}

          {stage === "password" ? (
            <>
              <p>Your temporary password has been verified. Replace it before any product opens.</p>
              <form onSubmit={submitPassword}>
                <label className="form-label">
                  New password
                  <input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required autoFocus />
                </label>
                <label className="form-label">
                  Confirm new password
                  <input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
                </label>
                <small className="field-note">Use at least 12 characters with upper-case, lower-case and a number.</small>
                <button className="button auth-submit" disabled={busy}>
                  {busy ? "Saving securely..." : "Save password and continue"}
                </button>
              </form>
            </>
          ) : null}

          {stage === "recovery" ? (
            <>
              <p>These one-use codes are the only fallback if your Authenticator is unavailable. Store them somewhere safe.</p>
              <div className="recovery-code-grid">
                {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
              </div>
              <button
                className="button auth-submit"
                onClick={() => {
                  const result = pendingResult;
                  setPendingResult(null);
                  setRecoveryCodes([]);
                  if (result) continueWith(result);
                }}
              >
                I have saved these codes
              </button>
            </>
          ) : null}

          {stage === "products" ? (
            <>
              <p>Your account has access to these products for this organisation.</p>
              <div className="product-access-grid">
                {choices.map((choice) => (
                  <button key={choice.code} type="button" onClick={() => handoff(choice)}>
                    <strong>{choice.name}</strong>
                    <span>{choice.description || "Open this workspace"}</span>
                    <b aria-hidden="true">Open</b>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {message ? (
            <div className="form-message" role="alert" aria-live="assertive"><p>{message}</p></div>
          ) : null}
          <div className="form-help">
            <Link href="/account-help">Forgotten password or need help?</Link>
            <span>Never share your password by email.</span>
          </div>
        </div>
        <Link className="auth-back" href="/">Back to CoreCare Systems</Link>
      </section>

      <section className="auth-visual">
        <div className="auth-visual-content">
          <p className="eyebrow light-eyebrow">One protected identity</p>
          <h2>One login.<br />The right access.</h2>
          <p>Organisation boundaries, product membership and local role permissions are checked before a workspace opens.</p>
          <div className="auth-product-list">
            {CUSTOMER_PRODUCTS.map((item) => (
              <article key={item.code}><i>{item.icon}</i><strong>{item.name}</strong></article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}