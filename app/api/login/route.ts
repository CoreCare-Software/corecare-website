import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { trialRequests } from "../../../db/schema";
import { getProduct, type ProductCode } from "../../products";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 1024) => String(value ?? "").trim().slice(0, max);

function messageFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return "We could not sign you in.";
  const value = payload as { message?: string; error?: string | { message?: string } };
  return clean(value.message || (typeof value.error === "string" ? value.error : value.error?.message) || "We could not sign you in.", 300);
}

function productOrigin(code: ProductCode, fallback: string) {
  const runtime = env as unknown as Record<string, string | undefined>;
  return clean(runtime[`CORECARE_${code}_ORIGIN`], 500) || fallback;
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = clean(input.email, 240).toLowerCase();
  const password = String(input.password || "");
  let product = getProduct(clean(input.productCode, 20));
  if (!EMAIL_PATTERN.test(email) || !password || password.length > 1024) return Response.json({ error: "Enter your email address and password." }, { status: 400 });

  if (!product) {
    try {
      const db = getDb();
      const matches = await db.select({ productCode: trialRequests.productCode }).from(trialRequests)
        .where(eq(trialRequests.email, email)).orderBy(desc(trialRequests.createdAt)).limit(10);
      const codes = [...new Set(matches.map((row) => row.productCode))];
      if (codes.length === 1) product = getProduct(codes[0]);
      if (codes.length > 1) return Response.json({ error: "You have access to more than one CoreCare product. Choose the product you want to open.", products: codes }, { status: 409 });
    } catch { /* A product can still be selected manually while D1 is unavailable. */ }
  }
  if (!product) return Response.json({ error: "Choose your CoreCare product so we can take you to the right sign-in." }, { status: 409 });
  const origin = productOrigin(product.code, product.liveUrl).replace(/\/$/, "");
  if (product.code === "PLATFORM") return Response.json({ ok: true, redirect: origin });

  try {
    const upstream = await fetch(`${origin}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": "CoreCare-Systems-Portal/1.0" }, body: JSON.stringify({ email, password }), redirect: "manual" });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return Response.json({ error: messageFrom(payload) }, { status: upstream.status === 429 ? 429 : 401, headers: { "cache-control": "no-store" } });
    const host = new URL(request.url).hostname.toLowerCase();
    const sharedDomainReady = host === "corecaresystems.co.uk" || host.endsWith(".corecaresystems.co.uk");
    if (!sharedDomainReady) return Response.json({ error: "Unified sign-in will become active when corecaresystems.co.uk and the product subdomains are connected.", directUrl: origin }, { status: 409 });
    const rawCookie = upstream.headers.get("set-cookie");
    if (!rawCookie) return Response.json({ error: "This product did not return a sign-in session." }, { status: 502 });
    const cookie = `${rawCookie.split(";").filter((part) => !part.trim().toLowerCase().startsWith("domain=")).join(";")}; Domain=.corecaresystems.co.uk`;
    return Response.json({ ok: true, redirect: origin }, { headers: { "set-cookie": cookie, "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "This CoreCare product could not be reached. Please try again shortly.", directUrl: origin }, { status: 502 });
  }
}
