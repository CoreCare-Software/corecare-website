import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MobileLoginClient } from "./mobile-login-client";
import { parseMobileAuthorizationSearch } from "./mobile-authorization";

const CANONICAL_LOGIN_HOST = "login.corecaresystems.co.uk";

export const metadata: Metadata = {
  title: "Sign in to CoreCare Mobile | CoreCare",
  description: "Securely continue from CoreCare to the CoreCare Mobile app.",
  robots: { index: false, follow: false },
};

type MobileLoginSearchParams = {
  client_id?: string | string[];
  redirect_uri?: string | string[];
  code_challenge?: string | string[];
  code_challenge_method?: string | string[];
  state?: string | string[];
};

export default async function MobileLoginPage({
  searchParams,
}: {
  searchParams: Promise<MobileLoginSearchParams>;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");

  if (host && host !== CANONICAL_LOGIN_HOST && host !== "localhost" && host !== "127.0.0.1") {
    const query = new URLSearchParams();
    for (const key of ["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state"] as const) {
      const value = params[key];
      if (typeof value === "string") query.set(key, value);
    }
    redirect(`https://${CANONICAL_LOGIN_HOST}/mobile-login?${query.toString()}`);
  }

  const parsed = parseMobileAuthorizationSearch(params);
  return <MobileLoginClient authorization={parsed.request} initialError={parsed.error} />;
}
