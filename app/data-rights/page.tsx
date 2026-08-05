import type { Metadata } from "next";
import DataRightsForm from "./data-rights-client";
import { MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "Your data rights", description: "How to make and track a privacy rights request to CoreCare Systems.", alternates: { canonical: "/data-rights" } };

export default function DataRightsPage() {
  return <MarketingShell><section className="content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Your data rights</p><h1>One secure route for a privacy request.</h1><p className="content-lead">Ask for access, correction, erasure, restriction, objection or portability. There is normally no fee. We record the request, identify the relevant CoreCare product and coordinate with the customer organisation where it is the controller.</p><p className="updated-note">Process version 5 August 2026</p></div></section>
    <section className="section"><div className="site-shell contact-grid"><DataRightsForm /><aside className="contact-aside"><p className="eyebrow">What happens next</p><ol><li><span>1</span><div><strong>We acknowledge and scope it</strong><p>Your reference, received date and response deadline are recorded centrally.</p></div></li><li><span>2</span><div><strong>We verify proportionately</strong><p>We ask only for the identity evidence reasonably needed to avoid disclosing information to the wrong person.</p></div></li><li><span>3</span><div><strong>We search the right systems</strong><p>Website, Platform and relevant product owners receive a tracked task. Legal holds and applicable exemptions are checked.</p></div></li><li><span>4</span><div><strong>We respond securely</strong><p>We normally respond without undue delay and within one calendar month. We explain any lawful extension or refusal.</p></div></li></ol><p className="aside-note">If your request concerns records held by a CoreCare customer, contact that organisation first where possible. CoreCare will assist it as processor.</p></aside></div></section>
  </MarketingShell>;
}
