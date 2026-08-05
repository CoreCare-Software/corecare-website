import type { Metadata } from "next";
import { MarketingShell } from "../site-chrome";

export const metadata: Metadata = { title: "Data retention policy", description: "CoreCare Systems retention schedule, deletion approach and legal-hold rules.", alternates: { canonical: "/data-retention" } };

const rows = [
  ["Website enquiries and demonstrations", "12 months after the last meaningful contact", "Follow-up, service improvement and resolving enquiry disputes"],
  ["Unconverted trial request and setup records", "90 days after trial expiry or failed setup", "Close the trial, prevent duplicate provisioning and resolve setup issues"],
  ["Customer account and contract administration", "Contract term plus 6 years", "Contract, tax, accounting and legal claim records"],
  ["Support tickets and authorised support evidence", "Contract term plus 3 years", "Service history, security investigation and dispute resolution"],
  ["Authentication attempts and expired sessions", "Up to 24 hours after they are no longer operationally required", "Account security and abuse prevention"],
  ["Security and audit records", "24 months by default; longer when tied to a legal hold, regulated record or active dispute", "Investigation, accountability and access history"],
  ["Privacy rights request records", "3 years after closure", "Demonstrate the request and response; request evidence is minimised"],
  ["Personal data breach register", "6 years after closure", "Accountability, learning, claims and regulatory evidence"],
  ["Customer product data", "Customer-configured period during service; export window then deletion after termination", "The customer is normally controller and sets the lawful business or sector period"],
  ["Protected recovery copies", "Expire through the provider recovery cycle after active deletion", "Resilience; copies are isolated and not returned to normal use except recovery"],
] as const;

export default function DataRetentionPage() {
  return <MarketingShell><section className="content-hero compact-content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Data retention policy</p><h1>Keep what is justified. Review it. Remove the rest.</h1><p className="content-lead">UK GDPR does not set one universal retention period. CoreCare uses the schedule below as its operational baseline, subject to customer instructions, sector rules and documented legal holds.</p><p className="updated-note">Version 1.0 · 5 August 2026</p></div></section><section className="section legal-section"><div className="site-shell legal-copy">
    <h2>Principles</h2><ul><li>Every category has a purpose, owner, review trigger and intended disposal action.</li><li>Product customers set retention for the records they control, especially care, employment, booking and financial records.</li><li>Deletion is suspended only where a law, claim, safeguarding need, regulator or documented legal hold requires it.</li><li>Where deletion would remove evidence needed for accountability, information is minimised, restricted or anonymised instead.</li><li>Retention actions are logged and reviewed; deletion is not based on an untested blanket query.</li></ul>
    <h2>Baseline schedule</h2><div className="legal-table-wrap"><table><thead><tr><th>Category</th><th>Baseline review or deletion point</th><th>Reason</th></tr></thead><tbody>{rows.map(([category, period, reason]) => <tr key={category}><td>{category}</td><td>{period}</td><td>{reason}</td></tr>)}</tbody></table></div>
    <h2>Product data and customer instructions</h2><p>CoreCare will not impose a generic automatic deletion period on a customer’s live operational records where the customer may have a different statutory or safeguarding duty. The customer must select and document the required period during onboarding. CoreCare provides export, access restriction and deletion assistance under the DPA. Where a setting has not yet been agreed, records are placed in a review queue rather than silently deleted.</p>
    <h2>End of service</h2><p>Unless the order states another period, CoreCare will make a reasonable export available for 30 days after service termination, then schedule active Customer Data for deletion. Protected recovery copies expire through the applicable recovery cycle. An account may be retained in a restricted state only for billing, dispute, security or legal requirements.</p>
    <h2>Review and evidence</h2><p>The schedule is reviewed at least annually and whenever a product, law, processing purpose or provider changes. Retention reviews record the category, scope, records considered, action, exceptions, approver and time. Questions or customer instructions can be sent to <a href="mailto:privacy@corecaresystems.co.uk">privacy@corecaresystems.co.uk</a>.</p>
  </div></section></MarketingShell>;
}
