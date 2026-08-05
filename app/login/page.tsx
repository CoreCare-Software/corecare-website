import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginClient from "./login-client";

export const metadata: Metadata = { title: "Log in", description: "Use one secure CoreCare login page to open the product your account can access.", alternates: { canonical: "/login" }, robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ product?: string; error?: string }> }) {
  const query = await searchParams;
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(":", 1)[0].toLowerCase();
  if (host && host !== "login.corecaresystems.co.uk" && host !== "localhost" && host !== "127.0.0.1") {
    const destination = new URL("https://login.corecaresystems.co.uk/login");
    if (query.product) destination.searchParams.set("product", query.product);
    if (query.error) destination.searchParams.set("error", query.error);
    redirect(destination.toString());
  }
  return <LoginClient initialProduct={query.product || ""} initialError={query.error === "invalid_credentials" ? "The email address or password was not accepted by that product." : ""} />;
}
