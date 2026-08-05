"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { CUSTOMER_PRODUCTS } from "../products";
import { Arrow } from "../site-chrome";

type RequestResult = { ok?: boolean; error?: string; reference?: string; dueAt?: string };

export default function DataRightsForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RequestResult | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/privacy/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
      const payload = await response.json() as RequestResult;
      setResult(payload);
      if (payload.ok) event.currentTarget.reset();
    } catch {
      setResult({ error: "We could not save your request. Please try again or email privacy@corecaresystems.co.uk." });
    } finally {
      setBusy(false);
    }
  }

  return <form className="contact-form" onSubmit={submit}>
    <input className="form-honeypot" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
    <div className="trial-form-grid">
      <label className="form-label">Your name<input name="requesterName" autoComplete="name" required /></label>
      <label className="form-label">Email address<input name="requesterEmail" type="email" autoComplete="email" required /></label>
      <label className="form-label">Organisation, if relevant<input name="organisationName" autoComplete="organization" /></label>
      <label className="form-label">Your relationship<select name="relationship" defaultValue="" required><option value="" disabled>Choose one</option><option value="website_visitor">Website visitor or enquirer</option><option value="customer_user">Customer or product user</option><option value="trial_user">Trial user</option><option value="employee_or_applicant">Worker or applicant</option><option value="other">Other</option></select></label>
      <label className="form-label">Request type<select name="requestType" defaultValue="" required><option value="" disabled>Choose one</option><option value="access">Access my information</option><option value="correction">Correct information</option><option value="erasure">Erase information</option><option value="restriction">Restrict processing</option><option value="objection">Object to processing</option><option value="portability">Receive portable information</option><option value="other">Another privacy request</option></select></label>
      <label className="form-label">Product, if relevant<select name="productCode" defaultValue=""><option value="">Website, Platform or not sure</option>{CUSTOMER_PRODUCTS.map((product) => <option key={product.code} value={product.code}>{product.name}</option>)}</select></label>
      <label className="form-label wide">What information or activity should we look for?<textarea name="requestSummary" rows={6} minLength={10} maxLength={2000} required /></label>
    </div>
    <p className="form-privacy-note">Do not upload identity documents, passwords, health records or payment details here. We will request proportionate identity evidence separately only if it is needed.</p>
    <label className="consent-row"><input type="checkbox" name="privacyAccepted" value="yes" required /><span>I have read the <Link href="/privacy">privacy notice</Link> and understand how this request will be handled.</span></label>
    {result?.error ? <p className="form-message" role="alert" aria-live="assertive">{result.error}</p> : null}
    {result?.ok ? <p className="form-message success" role="status" aria-live="polite">Your request has been recorded as <strong>{result.reference}</strong>. Keep this reference. We will acknowledge it using your email address.</p> : null}
    <button className="button auth-submit" disabled={busy}>{busy ? "Recording request…" : "Submit privacy request"} <Arrow /></button>
  </form>;
}
