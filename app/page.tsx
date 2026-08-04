import HomeClient from "./home-client";

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "CoreCare Systems",
    url: "https://www.corecaresystems.co.uk",
    email: "hello@corecaresystems.co.uk",
    areaServed: "GB",
    sameAs: [],
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /><HomeClient /></>;
}
