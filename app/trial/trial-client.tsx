"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { TRIAL_PRODUCTS } from "../products";
import { Brand } from "../site-chrome";
import { TurnstileWidget, type TurnstileHandle } from "../turnstile-widget";

type TrialResult = {
  ok?: boolean;
  existing?: boolean;
  message?: string;
  error?: string;
  product?: { name: string };
  statusUrl?: string;
};

export default function TrialClient({
  initialProduct = "",
}: {
  initialProduct?: string;
}) {
  const requested = initialProduct.toUpperCase();
  const [product, setProduct] = useState(
    TRIAL_PRODUCTS.some((item) => item.code === requested)
      ? requested
      : TRIAL_PRODUCTS[0].code,
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TrialResult | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  useEffect(() => {
    if (result) document.getElementById("trial-form-message")?.focus();
  }, [result]);
  function moveProduct(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = (index + 1) % TRIAL_PRODUCTS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index - 1 + TRIAL_PRODUCTS.length) % TRIAL_PRODUCTS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TRIAL_PRODUCTS.length - 1;
    else return;
    event.preventDefault();
    setProduct(TRIAL_PRODUCTS[next].code);
    document
      .getElementById(`trial-product-${TRIAL_PRODUCTS[next].code}`)
      ?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turnstileToken) {
      setResult({ error: "Complete the security verification and try again." });
      return;
    }
    setBusy(true);
    setResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/trials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(form.entries()),
          turnstileToken,
        }),
      });
      setResult((await response.json()) as TrialResult);
    } catch {
      setResult({
        error: "We could not reach the trial service. Please try again.",
      });
    } finally {
      turnstile.current?.reset();
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link href="/">
          <Brand />
        </Link>
        <div className="auth-form-wrap">
          {result?.ok ? (
            <div
              id="trial-form-message"
              className="trial-success-card"
              role="status"
              tabIndex={-1}
            >
              <p className="eyebrow">Request received</p>
              <h2>
                {result.existing
                  ? "Your request is already with us."
                  : "Your trial request is saved."}
              </h2>
              <p>
                {result.message ||
                  `We’ve saved your request for ${result.product?.name}. Your 30 days will begin when workspace access is activated, so preparation time is not taken from your trial.`}
              </p>
              {result.statusUrl ? (
                <Link className="button" href={result.statusUrl}>
                  View trial status <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <Link className="button" href="/login">
                  Go to login <span aria-hidden="true">→</span>
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="eyebrow">30-day free trial</p>
              <h1>Choose your CoreCare.</h1>
              <p>
                No card is needed. We prepare an evaluation workspace with
                representative information; your 30 days start only when access
                is activated. Real data, integrations and production readiness
                are agreed separately.
              </p>
          <form
            method="post"
            action="/api/trials"
            onSubmit={submit}
            aria-busy={busy}
          >
                <input
                  className="form-honeypot"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />
                <div
                  className="product-choices wide"
                  role="radiogroup"
                  aria-label="Choose a CoreCare product"
                >
                  {TRIAL_PRODUCTS.map((item, index) => (
                    <button
                      id={`trial-product-${item.code}`}
                      type="button"
                      role="radio"
                      aria-checked={product === item.code}
                      tabIndex={product === item.code ? 0 : -1}
                      key={item.code}
                      className={`product-choice${product === item.code ? " active" : ""}`}
                      onKeyDown={(event) => moveProduct(event, index)}
                      onClick={() => setProduct(item.code)}
                    >
                      <i style={{ background: item.soft, color: item.accent }}>
                        {item.icon}
                      </i>
                      <strong>{item.shortName}</strong>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="productCode" value={product} />
                <div className="trial-form-grid">
                  <label className="form-label">
                    Your name
                    <input name="contactName" autoComplete="name" required />
                  </label>
                  <label className="form-label">
                    Work email, or the email you use for your business
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="form-label wide">
                    Organisation
                    <input
                      name="companyName"
                      autoComplete="organization"
                      required
                    />
                  </label>
                  <label className="form-label">
                    Phone <span>(optional)</span>
                    <input name="phone" type="tel" autoComplete="tel" />
                  </label>
                  <label className="form-label">
                    Team size
                    <select name="teamSize" defaultValue="">
                      <option value="">Select</option>
                      <option>1–5</option>
                      <option>6–20</option>
                      <option>21–50</option>
                      <option>51–100</option>
                      <option>101+</option>
                    </select>
                  </label>
                </div>
                <label className="consent-row">
                  <input
                    type="checkbox"
                    name="privacyAccepted"
                    value="yes"
                    required
                  />
                  <span>
                    I have read the <Link href="/privacy">privacy notice</Link>{" "}
                    and understand how CoreCare will use this trial request.
                  </span>
                </label>
                <TurnstileWidget
                  ref={turnstile}
                  action="trial"
                  onToken={setTurnstileToken}
                />
                {result?.error ? (
                  <p
                    id="trial-form-message"
                    className="form-message"
                    role="alert"
                    aria-live="assertive"
                    tabIndex={-1}
                  >
                    {result.error}
                  </p>
                ) : null}
                <button
                  className="button auth-submit"
                  disabled={busy || !turnstileToken}
                >
                  {busy ? "Saving your request…" : "Request my free trial"}{" "}
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
            </>
          )}
        </div>
        <Link className="auth-back" href="/">
          ← Back to CoreCare Systems
        </Link>
      </section>
      <section className="auth-visual">
        <div className="auth-visual-content">
          <p className="eyebrow light-eyebrow">Time to explore properly</p>
          <h2>
            Thirty days.
            <br />A safe evaluation workspace.
          </h2>
          <p>
            Explore the representative workflow, clarify the production scope
            and decide whether the product fits your team.
          </p>
          <div className="auth-product-list">
            {TRIAL_PRODUCTS.map((item) => (
              <article key={item.code}>
                <i>{item.icon}</i>
                <strong>{item.name}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
