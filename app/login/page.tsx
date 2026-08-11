import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LoginClient from "./login-client";

export const metadata: Metadata = { title: "Log in", description: "Use one secure CoreCare login page to open the product your account can access.", alternates: { canonical: "/login" }, robots: { index: false, follow: false } };

type LoginQuery = {
  product?: string;
  error?: string;
  mobile?: string;
  clientId?: string;
  redirectUri?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  state?: string;
};

const LOGIN_HOSTS = new Set([
  "login.corecaresystems.co.uk",
  "corecare-website-staging.cselectricalservices11.workers.dev",
  "localhost",
  "127.0.0.1",
]);

export default async function LoginPage({ searchParams }: { searchParams: Promise<LoginQuery> }) {
  const query = await searchParams;
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "").split(":", 1)[0].toLowerCase();
  if (host && !LOGIN_HOSTS.has(host)) {
    const destination = new URL("https://login.corecaresystems.co.uk/login");
    if (query.product) destination.searchParams.set("product", query.product);
    if (query.error) destination.searchParams.set("error", query.error);
    for (const name of ["mobile", "clientId", "redirectUri", "codeChallenge", "codeChallengeMethod", "state"] as const) {
      if (query[name]) destination.searchParams.set(name, query[name] as string);
    }
    redirect(destination.toString());
  }
  const mobileAuthorization = query.mobile === "1"
    ? {
        clientId: query.clientId || "",
        redirectUri: query.redirectUri || "",
        codeChallenge: query.codeChallenge || "",
        codeChallengeMethod: query.codeChallengeMethod || "",
        state: query.state || "",
      }
    : null;
  return (
    <LoginClient
      initialProduct={query.product || ""}
      initialError={query.error === "invalid_credentials" ? "The email address or password was not accepted." : ""}
      mobileAuthorization={mobileAuthorization}
    />
  );
}
