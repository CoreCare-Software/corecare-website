import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginClient from "./login-client";

export const metadata: Metadata = { title: "Log in", description: "Use one secure CoreCare login page to open the product your account can access.", alternates: { canonical: "/login" }, robots: { index: false, follow: false } };

const LOGIN_HOSTS = new Set([
  "login.corecaresystems.co.uk",
  "corecare-website-staging.cselectricalservices11.workers.dev",
  "localhost",
  "127.0.0.1",
]);

const LOGIN_ERRORS: Readonly<Record<string, string>> = Object.freeze({
  invalid_credentials: "The email address, password, or secure handoff was not accepted.",
  identity_contract_failed: "CoreCare could not verify the One Login identity contract. No product session was created.",
  tenant_mapping_invalid: "Your organisation is not correctly linked to that product. CoreCare Support must correct the mapping.",
  user_mapping_missing: "Your CoreCare account is not linked to an active user in that product.",
  user_identity_mismatch: "The product user is linked to a different CoreCare identity. No access was granted.",
  role_mapping_invalid: "Your assigned CoreCare role does not match an allowed role in that product.",
  organisation_inactive: "That product organisation is not active.",
  tenant_site_missing: "Your POS site mapping is incomplete.",
  tenant_selection_required: "Garage requires one explicit organisation mapping before it can open.",
});

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ product?: string; error?: string }> }) {
  const query = await searchParams;
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(":", 1)[0].toLowerCase();
  if (host && !LOGIN_HOSTS.has(host)) {
    const destination = new URL("https://login.corecaresystems.co.uk/login");
    if (query.product) destination.searchParams.set("product", query.product);
    if (query.error) destination.searchParams.set("error", query.error);
    redirect(destination.toString());
  }
  return <LoginClient initialProduct={query.product || ""} initialError={LOGIN_ERRORS[query.error || ""] || ""} />;
}
