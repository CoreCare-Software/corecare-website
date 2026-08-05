"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brand } from "../../site-chrome";

type BillingPlan = { id: string; name: string; monthlyPricePence: number; ready?: boolean };
type BillingState = {
  available: boolean;
  mode: "live" | "test" | "unavailable";
  plans: BillingPlan[];
  checkoutStatus?: string;
  subscriptionStatus?: string;
  access?: { mode: "full" | "read_only" | "locked"; reason: string; subscriptionStatus: string };
};
type StatusResult = {
  error?: string;
  trial?: { companyName: string; status: string; startsAt: string | null; endsAt: string | null; daysRemaining: number; provisioningStatus: string; provisioningError?: string | null; needsPassword: boolean };
  product?: { code: string; name: string; liveUrl: string };
  billing?: BillingState;
};

const pounds = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(pence / 100);

export default function StatusClient({ token }: { token: string }) {
  const [data, setData] = useState<StatusResult | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState("");

  const load = useCallback(() => {
    fetch("/api/trials/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then((response) => response.json()).then(setData).catch(() => setData({ error: "We could not load this trial." }));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (password !== confirmPassword) return setMessage("The passwords do not match.");
    setBusy(true);
    try {
      const response = await fetch("/api/trials/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) setMessage(result.error || "Your workspace could not be activated yet.");
      else { setPassword(""); setConfirmPassword(""); load(); }
    } catch { setMessage("Your workspace could not be activated yet."); }
    finally { setBusy(false); }
  }

  async function startCheckout(planId: string) {
    setCheckoutPlan(planId); setMessage("");
    try {
      const response = await fetch("/api/trials/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, planId }) });
      const result = await response.json() as { error?: string; url?: string; mode?: string };
      if (!response.ok || !result.url || !["live", "test"].includes(result.mode || "")) setMessage(result.error || "Secure Stripe checkout is not ready yet.");
      else window.location.assign(result.url);
    } catch { setMessage("Secure Stripe checkout is not ready yet."); }
    finally { setCheckoutPlan(""); }
  }

  const expired = data?.trial?.status === "expired";
  const converted = data?.trial?.status === "converted";
  const requested = data?.trial?.status === "requested";
  const end = data?.trial?.endsAt ? new Date(data.trial.endsAt) : null;
  const billingReady = expired && data?.billing?.available && ["live", "test"].includes(data.billing.mode);
  const testBilling = data?.billing?.mode === "test";
  const liveSubscription = converted && data?.billing?.mode === "live";

  return <main className="auth-page">
    <section className="auth-panel">
      <Link href="/"><Brand /></Link>
      <div className="auth-form-wrap">
        <p className="eyebrow">Trial status</p>
        {!data ? <h1>Loading your trial…</h1> : data.error ? <><h1>We couldn’t find that trial.</h1><p>{data.error}</p><Link className="button" href="/trial">Start a new trial</Link></> : <>
          <h1>{data.product?.name}</h1><p>{data.trial?.companyName}</p>
          <div className="trial-success-card">
            <p className="eyebrow">{converted ? liveSubscription ? "Paid subscription active" : "Test subscription active" : requested ? "Workspace setup" : expired ? "Trial complete" : `${data.trial?.daysRemaining} days remaining`}</p>
            <h2>{converted ? liveSubscription ? "Your CoreCare subscription is active." : "The complete billing journey works." : data.trial?.needsPassword ? "Create your secure password." : requested ? "Your workspace is being prepared." : expired ? "Ready to keep going?" : "Your trial is active."}</h2>
            <p>{converted ? liveSubscription ? "Your live Stripe subscription is active and your product access is ready." : "This is a Stripe test subscription. No real payment was taken and it does not start a live commercial subscription." : data.trial?.needsPassword ? "Your product workspace is ready. Choose your password to activate access and begin the 30-day trial." : requested ? "Your 30-day period has not started yet. Refresh this page shortly; it begins only after access is activated." : expired ? "Choose a monthly plan below. Live checkout securely collects payment through Stripe; any test checkout is clearly identified and cannot take real money." : `Your current trial period ends on ${end?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`}</p>
            {data.trial?.needsPassword ? <form onSubmit={activate}>
              <label className="form-label">Password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
              <label className="form-label">Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
              <p className="password-guidance">Use at least 12 characters with an upper-case letter, lower-case letter and number.</p>
              {message ? <p className="form-message" role="alert">{message}</p> : null}
              <button className="button auth-submit" disabled={busy}>{busy ? "Activating…" : "Activate my 30-day trial"} <span aria-hidden="true">↗</span></button>
            </form> : converted && data.product?.liveUrl ? <a className="button" href={data.product.liveUrl}>Open {data.product.name} <span aria-hidden="true">↗</span></a> : billingReady ? <div>
              <p className="password-guidance">{testBilling ? <><strong>Stripe test mode:</strong> use a Stripe test card only. No real card or payment will be accepted.</> : <><strong>Secure live checkout:</strong> Stripe will collect the payment details for the monthly subscription you choose.</>}</p>
              <div className="trial-plan-actions">{data.billing?.plans.map((plan) => <button key={plan.id} className="secondary-button" type="button" disabled={Boolean(checkoutPlan)} onClick={() => startCheckout(plan.id)}>{checkoutPlan === plan.id ? "Opening…" : `${plan.name} — ${pounds(plan.monthlyPricePence)}/month`}</button>)}</div>
              {message ? <p className="form-message" role="alert">{message}</p> : null}
            </div> : expired ? <><Link className="button" href={`/plans?product=${encodeURIComponent(data.product?.code || "")}`}>View plan options <span aria-hidden="true">→</span></Link>{message ? <p className="form-message" role="alert">{message}</p> : null}</> : !requested && data.product?.liveUrl ? <a className="button" href={data.product.liveUrl}>Open {data.product.name} <span aria-hidden="true">↗</span></a> : <button className="secondary-button" type="button" onClick={load}>Refresh setup status</button>}
          </div>
        </>}
      </div>
      <Link className="auth-back" href="/">← Back to CoreCare Systems</Link>
    </section>
    <section className="auth-visual"><div className="auth-visual-content"><p className="eyebrow light-eyebrow">Your CoreCare journey</p><h2>Clear dates.<br />No surprises.</h2><p>Your trial clock starts with active workspace access, not with the form submission.</p></div></section>
  </main>;
}
