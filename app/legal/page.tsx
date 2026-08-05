import type { Metadata } from "next";
import { COMPANY_ADDRESS, COMPANY_DETAILS } from "../company-details";
import { MarketingShell } from "../site-chrome";

export const metadata: Metadata = {
  title: "Legal information",
  description: "Contracting identity and contact information for CoreCare Systems.",
  alternates: { canonical: "/legal" },
};

export default function LegalInformationPage() {
  return <MarketingShell><section className="content-hero compact-content-hero"><div className="site-shell narrow-heading"><p className="eyebrow">Legal information</p><h1>Who operates CoreCare Systems.</h1><p className="content-lead">The identity and contact information below applies to this website and is used as the contracting information unless a customer order expressly states otherwise.</p><p className="updated-note">Last updated 5 August 2026</p></div></section><section className="section legal-section"><div className="site-shell legal-copy"><h2>Contracting and trading name</h2><p>{COMPANY_DETAILS.legalName}</p><h2>Trading address</h2><address>{COMPANY_ADDRESS}<br />{COMPANY_DETAILS.country}</address><h2>Contact</h2><p>Telephone: <a href={`tel:${COMPANY_DETAILS.telephoneHref}`}>{COMPANY_DETAILS.telephoneDisplay}</a><br />Email: <a href="mailto:hello@corecaresystems.co.uk">hello@corecaresystems.co.uk</a></p><h2>Registration information</h2><ul><li>Company number: not applicable</li><li>VAT registration: not VAT registered</li><li>ICO registration number: not currently registered</li></ul><p>If any of this information changes, this page and the relevant customer documents will be updated.</p></div></section></MarketingShell>;
}
