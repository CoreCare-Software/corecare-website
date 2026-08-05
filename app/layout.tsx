import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "www.corecaresystems.co.uk";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    metadataBase: new URL(origin),
    title: { default: "CoreCare Systems | Business software in one place", template: "%s | CoreCare Systems" },
    description: "Discover CoreCare Care, Campsites, Finance, Garage and POS. Explore the suite, start a 30-day trial and access every CoreCare product from one place.",
    applicationName: "CoreCare Systems",
    creator: "Christopher Anthony Warman, trading as CoreCare Systems",
    publisher: "CoreCare Systems",
    keywords: ["CoreCare Systems UK", "care management software", "campsite booking software", "garage management software", "hospitality POS", "small business finance software"],
    robots: { index: true, follow: true },
    alternates: { canonical: "/" },
    openGraph: { type: "website", title: "CoreCare Systems | Business software in one place", description: "Focused business software for care, campsites, finance, garages and hospitality, with guided trials and onboarding.", url: origin, siteName: "CoreCare Systems", images: [{ url: `${origin}/og.png`, width: 1730, height: 909, alt: "CoreCare Systems customer product suite" }] },
    twitter: { card: "summary_large_image", title: "CoreCare Systems", description: "Focused business software, guided trials and one clear place to begin.", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
