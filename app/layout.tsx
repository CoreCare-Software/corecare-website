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
    title: { default: "CoreCare Systems | One Login. Every Product.", template: "%s | CoreCare Systems" },
    description: "Discover CoreCare Care, Campsites, Finance, Garage and POS. Explore the suite, start a 30-day trial and access every CoreCare product from one place.",
    applicationName: "CoreCare Systems",
    alternates: { canonical: "/" },
    openGraph: { type: "website", title: "One front door. Every CoreCare product.", description: "Focused business software for care, campsites, finance, garages and hospitality — connected as one CoreCare ecosystem.", url: origin, siteName: "CoreCare Systems", images: [{ url: `${origin}/og.png`, width: 1730, height: 909, alt: "CoreCare Systems product suite" }] },
    twitter: { card: "summary_large_image", title: "CoreCare Systems", description: "One front door. Every CoreCare product.", images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
