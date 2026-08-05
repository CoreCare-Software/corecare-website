import HomeClient from "./home-client";
import { COMPANY_DETAILS } from "./company-details";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(":", 1)[0].toLowerCase();
  if (host === "login.corecaresystems.co.uk") redirect("/login");
  const structuredData = [{
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CoreCare Systems",
    url: "https://www.corecaresystems.co.uk",
    email: "hello@corecaresystems.co.uk",
    telephone: COMPANY_DETAILS.telephoneHref,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${COMPANY_DETAILS.addressLine1}, ${COMPANY_DETAILS.addressLine2}`,
      addressLocality: `${COMPANY_DETAILS.locality}, ${COMPANY_DETAILS.postTown}`,
      postalCode: COMPANY_DETAILS.postcode,
      addressCountry: "GB",
    },
    areaServed: "GB",
    founder: { "@type": "Person", name: COMPANY_DETAILS.proprietorName },
    sameAs: [],
  }, {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "CoreCare Systems",
    alternateName: "CoreCare Systems UK",
    url: "https://www.corecaresystems.co.uk",
    publisher: { "@type": "Organization", name: "CoreCare Systems" },
  }];
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><HomeClient /></>;
}
