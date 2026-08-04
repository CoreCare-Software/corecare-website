"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "../../site-chrome";

type StatusResult = { error?: string; trial?: { companyName: string; status: string; startsAt: string | null; endsAt: string | null; daysRemaining: number; provisioningStatus: string }; product?: { code: string; name: string; liveUrl: string } };

export default function StatusClient({ token }: { token: string }) {
  const [data, setData] = useState<StatusResult | null>(null);
  useEffect(() => { let active = true; fetch("/api/trials/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).then((response) => response.json()).then((payload) => { if (active) setData(payload); }).catch(() => { if (active) setData({ error: "We could not load this trial." }); }); return () => { active = false; }; }, [token]);
  const expired = data?.trial?.status === "expired";
  const requested = data?.trial?.status === "requested";
  const end = data?.trial?.endsAt ? new Date(data.trial.endsAt) : null;
  return <main className="auth-page"><section className="auth-panel"><Link href="/"><Brand /></Link><div className="auth-form-wrap"><p className="eyebrow">Trial status</p>{!data ? <h1>Loading your trial…</h1> : data.error ? <><h1>We couldn’t find that trial.</h1><p>{data.error}</p><Link className="button" href="/trial">Start a new trial</Link></> : <><h1>{data.product?.name}</h1><p>{data.trial?.companyName}</p><div className="trial-success-card"><p className="eyebrow">{requested ? "Workspace setup" : expired ? "Trial complete" : `${data.trial?.daysRemaining} days remaining`}</p><h2>{requested ? "Your request is in the setup queue." : expired ? "Ready to keep going?" : "Your trial is active."}</h2><p>{requested ? "Your 30-day period has not started yet. It begins when workspace access is activated." : `Your current trial period ends on ${end?.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.`}</p>{expired ? <Link className="button" href={`/plans?product=${encodeURIComponent(data.product?.code || "")}`}>View plan options <span aria-hidden="true">→</span></Link> : !requested && data.product?.liveUrl ? <a className="button" href={data.product.liveUrl}>Open {data.product.name} <span aria-hidden="true">↗</span></a> : <Link className="secondary-button" href="/contact">Ask about setup</Link>}</div></>}</div><Link className="auth-back" href="/">← Back to CoreCare Systems</Link></section><section className="auth-visual"><div className="auth-visual-content"><p className="eyebrow light-eyebrow">Your CoreCare journey</p><h2>Clear dates.<br />No surprises.</h2><p>Your trial clock starts with active workspace access, not with the form submission.</p></div></section></main>;
}
