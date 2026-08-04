import type { Metadata } from "next";
import LoginClient from "./login-client";

export const metadata: Metadata = { title: "Log in", description: "Use one secure CoreCare login page to open the product your account can access.", alternates: { canonical: "/login" }, robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ product?: string; error?: string }> }) {
  const query = await searchParams;
  return <LoginClient initialProduct={query.product || ""} initialError={query.error === "invalid_credentials" ? "The email address or password was not accepted by that product." : ""} />;
}
