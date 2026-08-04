"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StatusResult = { error?: string; trial?: { companyName: string; status: string; startsAt: string; endsAt: string }; product?: { name: string; liveUrl: string } };
function Brand() { return <span className="brand-lockup"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span><strong>CoreCare</strong><small>Systems</small></span></span>; }

export default function StatusClient() {
  const [data, setData] = useState<StatusResult | null>(null);
  useEffect(() => { const token = new URLSearchParams(window.location.search).get("token") || ""; fetch("/api/trials/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).then((response) => response.json()).then(setData).catch(() => setData({ error: "We could not load this trial." })); }, []);
  const end = data?.trial ? new Date(data.trial.endsAt) : null;
  const days = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)) : 0;
  const expired = data?.trial?.status === "expired";
  return <main className="auth-page"><section className="auth-panel"><Link href="/"><Brand /></Link><div className="auth-form-wrap"><p className="eyebrow">Trial status</p>{!data ? <h1>Loading your trial…</h1> : data.error ? <><h1>We couldn’t find that trial.</h1><p>{data.error}</p><Link className="button" href="/trial">Start a new trial</Link></> : <><h1>{data.product?.name}</h1><p>{data.trial?.companyName}</p><div className="trial-success-card"><p className="eyebrow">{data.trial?.status === "requested" ? "Setup requested" : expired ? "Trial complete" : `${days} days remaining`}</p><h2>{data.trial?.status === "requested" ? "Your workspace setup is being prepared." : expired ? "Ready to keep going?" : "Your trial is active."}</h2><p>{data.trial?.status === "requested" ? "Your 30-day period will be confirmed with your access, so setup time is not taken from your trial." : `Your current trial period ends on ${end?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`}</p>{expired ? <a className="button" href={`mailto:hello@corecaresystems.co.uk?subject=${encodeURIComponent(`Continue ${data.product?.name}`)}`}>Choose a paid plan <span>↗</span></a> : data.product?.liveUrl ? <a className="button" href={data.product.liveUrl}>Open {data.product.name} <span>↗</span></a> : null}</div></>}</div><Link className="auth-back" href="/">← Back to CoreCare Systems</Link></section><section className="auth-visual"><div className="auth-visual-content"><p className="eyebrow light-eyebrow">Your CoreCare journey</p><h2>Clear dates.<br />No surprises.</h2><p>Your status page keeps the important trial details in one place and makes the next step clear when you are ready.</p></div></section></main>;
}
