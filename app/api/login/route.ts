import { env } from "cloudflare:workers";
import { getProduct, type ProductCode } from "../../products";
import { readJsonObject } from "../_shared/body";
import { allowFormRequest, recordEvent, validSameOriginRequest } from "../_shared/forms";
import { turnstileRejected, verifyTurnstile } from "../_shared/turnstile";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 1024) => String(value ?? "").trim().slice(0, max);

type BrokerMatch = { code: ProductCode | "PLATFORM"; grant: string; expiresAt?: string };
type BrokerResult = { ok?: boolean; status?: number; matches?: BrokerMatch[] };
type BrokerBinding = { fetch(request: Request): Promise<Response> };

function ownerEmailAllowed(email: string) {
  const runtime = env as unknown as Record<string, unknown>;
  const emails = clean(runtime.CORECARE_OWNER_EMAILS, 1_000).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return new Set(emails).has(email);
}

function targetFor(match: BrokerMatch) {
  if (match.code === "PLATFORM") return {
    code: match.code,
    name: "CoreCare Administration",
    handoffUrl: "https://owner.corecaresystems.co.uk/api/auth/portal-claim",
    grant: match.grant,
  };
  const product = getProduct(match.code);
  return product ? {
    code: product.code,
    name: product.name,
    handoffUrl: `${product.liveUrl.replace(/\/$/, "")}/api/auth/portal-claim`,
    grant: match.grant,
  } : null;
}

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This sign-in request could not be verified." }, { status: 403 });
  const parsed = await readJsonObject(request, 8_192);
  if (!parsed.ok) return parsed.response;
  if (!await verifyTurnstile(request, parsed.value.turnstileToken, "login")) return turnstileRejected();
  const rate = await allowFormRequest(request, "login-portal", 10, 15);
  if (!rate.allowed) return Response.json({ error: "Too many sign-in attempts were made from this connection. Please wait and try again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
  const email = clean(parsed.value.email, 320).toLowerCase();
  const password = String(parsed.value.password || "");
  const selected = getProduct(clean(parsed.value.productCode, 20));
  if (!EMAIL_PATTERN.test(email) || !password || password.length > 1_024) return Response.json({ error: "Enter your email address and password." }, { status: 400 });
  const runtime = env as unknown as { CORECARE_PLATFORM?: BrokerBinding };
  if (!runtime.CORECARE_PLATFORM?.fetch) return Response.json({ error: "The CoreCare login service is not configured." }, { status: 503 });
  let upstream: Response;
  try {
    upstream = await runtime.CORECARE_PLATFORM.fetch(new Request("https://portal-broker.internal/login", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        email,
        password,
        requestedProduct: selected?.code || "",
        includePlatform: !selected && ownerEmailAllowed(email),
        ip: clean(request.headers.get("cf-connecting-ip"), 64),
        userAgent: clean(request.headers.get("user-agent"), 250),
      }),
    }));
  } catch {
    return Response.json({ error: "The CoreCare login service could not be reached. Please try again shortly." }, { status: 502, headers: { "cache-control": "no-store" } });
  }

  const payload = await upstream.json().catch(() => ({})) as BrokerResult;
  const targets = (payload.matches || []).map(targetFor).filter((value) => value !== null);
  await recordEvent(selected ? "login_check" : "login_discovery", { productCode: selected?.code, path: "/login", outcome: targets.length === 0 ? String(upstream.status) : targets.length === 1 ? "single" : "multiple" });
  if (targets.length === 1) return Response.json({ ok: true, product: { code: targets[0].code, name: targets[0].name }, handoffUrl: targets[0].handoffUrl, grant: targets[0].grant }, { headers: { "cache-control": "no-store" } });
  if (targets.length > 1) return Response.json({
    error: "Your account is valid in more than one CoreCare product. Choose the workspace you want to open.",
    products: targets,
  }, { status: 409, headers: { "cache-control": "no-store" } });
  const status = upstream.status === 429 ? 429 : upstream.status >= 500 ? 502 : 401;
  const error = status === 429 ? "Too many unsuccessful attempts. Please wait before trying again." : status === 502 ? "CoreCare products could not be reached. Please try again shortly." : "The email address or password was not accepted by any CoreCare product.";
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}
