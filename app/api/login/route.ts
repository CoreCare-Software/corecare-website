import { env } from "cloudflare:workers";
import { PRODUCTS, getProduct, type CoreCareProduct, type ProductCode } from "../../products";
import { allowFormRequest, recordEvent, validSameOriginRequest } from "../_shared/forms";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 1024) => String(value ?? "").trim().slice(0, max);

function messageFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return "We could not sign you in.";
  const value = payload as { message?: string; error?: string | { message?: string } };
  return clean(value.message || (typeof value.error === "string" ? value.error : value.error?.message) || "We could not sign you in.", 300);
}

function productOrigin(code: ProductCode, fallback: string) {
  const runtime = env as unknown as Record<string, string | undefined>;
  return (clean(runtime[`CORECARE_${code}_ORIGIN`], 500) || fallback).replace(/\/$/, "");
}

async function checkCredentials(product: CoreCareProduct, email: string, password: string) {
  const origin = productOrigin(product.code, product.liveUrl);
  try {
    const upstream = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": "CoreCare-Systems-Portal/2.0" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return { valid: false as const, status: upstream.status, message: messageFrom(payload), origin };
    const rawCookie = upstream.headers.get("set-cookie") || "";
    const sessionCookie = rawCookie.split(";", 1)[0];
    if (sessionCookie) {
      await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { cookie: sessionCookie, accept: "application/json", "user-agent": "CoreCare-Systems-Portal/2.0" }, signal: AbortSignal.timeout(5_000) }).catch(() => undefined);
    }
    return { valid: true as const, status: 200, origin };
  } catch {
    return { valid: false as const, status: 502, message: `${product.name} could not be reached.`, origin };
  }
}

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This sign-in request could not be verified." }, { status: 403 });
  const input = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = clean(input.email, 240).toLowerCase();
  const password = String(input.password || "");
  const selected = getProduct(clean(input.productCode, 20));
  if (!EMAIL_PATTERN.test(email) || !password || password.length > 1024) return Response.json({ error: "Enter your email address and password." }, { status: 400 });
  const rate = await allowFormRequest(request, "login-portal", 10, 15);
  if (!rate.allowed) return Response.json({ error: "Too many sign-in attempts were made from this connection. Please wait and try again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });

  if (selected) {
    const result = await checkCredentials(selected, email, password);
    await recordEvent("login_check", { productCode: selected.code, path: "/login", outcome: result.valid ? "valid" : String(result.status) });
    if (!result.valid) return Response.json({ error: result.message, directUrl: result.status === 502 ? result.origin : undefined }, { status: result.status === 429 ? 429 : result.status === 502 ? 502 : 401, headers: { "cache-control": "no-store" } });
    return Response.json({ ok: true, product: { code: selected.code, name: selected.name }, handoffUrl: `${result.origin}/auth/portal-login` }, { headers: { "cache-control": "no-store" } });
  }

  const results = await Promise.all(PRODUCTS.map(async (product) => ({ product, result: await checkCredentials(product, email, password) })));
  const matches = results.filter((entry) => entry.result.valid);
  await recordEvent("login_discovery", { path: "/login", outcome: matches.length === 0 ? "none" : matches.length === 1 ? "single" : "multiple" });
  if (matches.length === 1) {
    const match = matches[0];
    return Response.json({ ok: true, product: { code: match.product.code, name: match.product.name }, handoffUrl: `${match.result.origin}/auth/portal-login` }, { headers: { "cache-control": "no-store" } });
  }
  if (matches.length > 1) return Response.json({ error: "Your account is valid in more than one CoreCare product. Choose the workspace you want to open.", products: matches.map(({ product }) => ({ code: product.code, name: product.name })) }, { status: 409, headers: { "cache-control": "no-store" } });
  const unavailable = results.every(({ result }) => result.status === 502);
  const locked = results.some(({ result }) => result.status === 429);
  return Response.json({ error: unavailable ? "CoreCare products could not be reached. Please try again shortly." : locked ? "Too many unsuccessful attempts. Please wait before trying again." : "The email address or password was not accepted by any CoreCare product." }, { status: unavailable ? 502 : locked ? 429 : 401, headers: { "cache-control": "no-store" } });
}
