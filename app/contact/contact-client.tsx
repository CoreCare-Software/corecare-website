"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { COMPANY_ADDRESS, COMPANY_DETAILS } from "../company-details";
import { CUSTOMER_PRODUCTS } from "../products";
import { Arrow, MarketingShell } from "../site-chrome";
import { TurnstileWidget, type TurnstileHandle } from "../turnstile-widget";

type ContactResult = { ok?: boolean; error?: string; reference?: string };

export default function ContactClient() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ContactResult | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstile = useRef<TurnstileHandle>(null);
  useEffect(() => {
    if (result) document.getElementById("contact-form-message")?.focus();
  }, [result]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turnstileToken) {
      setResult({ error: "Complete the security verification and try again." });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(form.entries()),
          turnstileToken,
        }),
      });
      const payload = (await response.json()) as ContactResult;
      setResult(payload);
      if (payload.ok) event.currentTarget.reset();
    } catch {
      setResult({ error: "We could not send your enquiry. Please try again." });
    } finally {
      turnstile.current?.reset();
      setBusy(false);
    }
  }
  return (
    <MarketingShell>
      <section className="content-hero">
        <div className="site-shell contact-heading">
          <div>
            <p className="eyebrow">Talk to CoreCare</p>
            <h1>Show us how your day works.</h1>
            <p className="content-lead">
              Ask a question or book a tailored demonstration. We will use your
              information only to respond and arrange the next step.
            </p>
          </div>
          <div className="contact-direct">
            <strong>Contact CoreCare Systems</strong>
            <a href="mailto:hello@corecaresystems.co.uk">
              hello@corecaresystems.co.uk
            </a>
            <a href={`tel:${COMPANY_DETAILS.telephoneHref}`}>
              {COMPANY_DETAILS.telephoneDisplay}
            </a>
            <span>{COMPANY_ADDRESS}</span>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="site-shell contact-grid">
          <form
            className="contact-form"
            method="post"
            action="/api/contact"
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
              <label className="form-label">
                Organisation
                <input
                  name="companyName"
                  autoComplete="organization"
                  required
                />
              </label>
              <label className="form-label">
                Product
                <select name="productCode" defaultValue="">
                  <option value="">General enquiry</option>
                  {CUSTOMER_PRODUCTS.map((product) => (
                    <option key={product.code} value={product.code}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-label wide">
                How can we help?
                <textarea name="message" rows={6} minLength={10} required />
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
                I have read the <Link href="/privacy">privacy notice</Link> and
                understand how CoreCare will use this enquiry.
              </span>
            </label>
            <TurnstileWidget
              ref={turnstile}
              action="contact"
              onToken={setTurnstileToken}
            />
            {result?.error ? (
              <p
                id="contact-form-message"
                className="form-message"
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
              >
                {result.error}
              </p>
            ) : null}
            {result?.ok ? (
              <p
                id="contact-form-message"
                className="form-message success"
                role="status"
                aria-live="polite"
                tabIndex={-1}
              >
                Thank you. Your enquiry has been saved with reference{" "}
                {result.reference}. We will respond using your email address.
              </p>
            ) : null}
            <button
              className="button auth-submit"
              disabled={busy || !turnstileToken}
            >
              {busy ? "Sending…" : "Send enquiry"} <Arrow />
            </button>
          </form>
          <aside className="contact-aside">
            <p className="eyebrow">What happens next</p>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <strong>We read the context</strong>
                  <p>Your message goes to the CoreCare enquiry queue.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>We arrange the right conversation</strong>
                  <p>
                    We focus the demonstration on the product and workflow you
                    need.
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>You choose the next step</strong>
                  <p>
                    Start a no-card trial, request a quote or leave it there.
                  </p>
                </div>
              </li>
            </ol>
          </aside>
        </div>
      </section>
    </MarketingShell>
  );
}
