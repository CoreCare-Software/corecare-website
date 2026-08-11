/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { allowFormRequest, recordEvent, validSameOriginRequest } from "../app/api/_shared/forms";
import { turnstileRejected, verifyTurnstile } from "../app/api/_shared/turnstile";
import { recordRuntimeError } from "./runtime-errors";
import { normalisePortalMatches } from "./portal-matches.js";

const PUBLIC_ASSET_PREFIX = "/_corecare-static";

interface PortalBinding extends Fetcher {
  verifyMfa(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  completePasswordSetup(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  CORECARE_PLATFORM_PORTAL: PortalBinding;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const FORM_QUERY_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "/login": ["email", "password", "productCode"],
  "/trial": ["contactName", "email", "companyName", "phone", "teamSize", "productCode", "privacyAccepted", "website"],
  "/contact": ["contactName", "email", "companyName", "productCode", "message", "privacyAccepted", "website"],
  "/account-help": ["contactName", "email", "companyName", "productCode", "privacyAccepted", "website"],
  "/data-rights": ["requesterName", "requesterEmail", "organisationName", "relationship", "requestType", "productCode", "requestSummary", "privacyAccepted", "website"],
  "/trial/status": ["password", "confirmPassword"],
});

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const requestId = request.headers.get('cf-ray') || crypto.randomUUID();
    try {
    const formPath = url.pathname.replace(/\/+$/, "") || "/";
    if (request.method === "GET" && FORM_QUERY_FIELDS[formPath]?.some((field) => url.searchParams.has(field))) {
      return withProductionHeaders(request, new Response("Form details must be submitted securely using POST.", {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      }));
    }
    if (url.hostname === "corecaresystems.co.uk") {
      url.hostname = "www.corecaresystems.co.uk";
      return withProductionHeaders(request, Response.redirect(url.toString(), 308));
    }
    let response: Response;

    if (url.pathname === "/api/login") {
      response = await handleOneLogin(request, env);
    } else if (url.pathname === "/api/login/mfa") {
      response = await handleMfa(request, env);
    } else if (url.pathname === "/api/login/password") {
      response = await handlePasswordSetup(request, env);
    } else if (url.pathname.startsWith(PUBLIC_ASSET_PREFIX + "/assets/")) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = url.pathname.slice(PUBLIC_ASSET_PREFIX.length);
      response = await env.ASSETS.fetch(new Request(assetUrl, request));
    } else if (/^\/(?:assets|_next\/static)\//.test(url.pathname)) {
      response = await env.ASSETS.fetch(request);
    } else if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    } else {
      response = await handler.fetch(request, env, ctx);
    }
    return withProductionHeaders(request, response);
    } catch (error) {
      await recordRuntimeError(env,{requestId,productCode:'WEBSITE',route:url.pathname,method:request.method,statusCode:500,error});
      return withProductionHeaders(request,Response.json({error:'CoreCare could not complete this request.',requestId},{status:500,headers:{'cache-control':'no-store','x-request-id':requestId}}));
    }
  },
};

async function handleOneLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Use POST to sign in." }, { status: 405, headers: { Allow: "POST" } });
  if (!validSameOriginRequest(request)) return Response.json({ error: "This sign-in request could not be verified." }, { status: 403 });
  if (!env.CORECARE_PLATFORM_PORTAL?.fetch) return Response.json({ error: "CoreCare one-login is not configured." }, { status: 503 });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "Enter your email address and password." }, { status: 400 }); }
  if (!await verifyTurnstile(request, input.turnstileToken, "login")) return turnstileRejected();
  const rate = await allowFormRequest(request, "login-portal", 10, 15);
  if (!rate.allowed) return Response.json({
    error: "Too many sign-in attempts were made from this connection. Please wait and try again.",
  }, {
    status: 429,
    headers: { "retry-after": String(rate.retryAfter), "cache-control": "no-store" },
  });
  const upstream = await env.CORECARE_PLATFORM_PORTAL.fetch(new Request("https://corecare-platform.internal/login", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      email: input.email, password: input.password,
      requestedProduct: input.requestedProduct || input.productCode || input.product,
      ip: request.headers.get("cf-connecting-ip") || "website",
      userAgent: request.headers.get("user-agent") || "CoreCare-Website/1.0",
    }),
  }));
  const payload = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  if (String(payload.code || "") === "MFA_REQUIRED" && payload.mfa) return Response.json({ ok: true, stage: "mfa", mfa: payload.mfa }, { status: 202 });
  if (String(payload.code || "") === "PASSWORD_CHANGE_REQUIRED" && payload.setup) return Response.json({ ok: true, stage: "password", setup: payload.setup }, { status: 202 });
  const matchCount = Array.isArray(payload.matches) ? payload.matches.length : 0;
  await recordEvent("login_discovery", {
    productCode: String(input.requestedProduct || input.productCode || input.product || ""),
    path: "/login",
    outcome: payload.ok === true ? (matchCount > 1 ? "multiple" : matchCount === 1 ? "single" : "none") : String(payload.code || upstream.status),
  });
  return portalResult(payload, upstream.status);
}

async function handleMfa(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Use POST to verify Authenticator." }, { status: 405, headers: { Allow: "POST" } });
  let input: Record<string, unknown>; try { input = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Enter the current Authenticator code." }, { status: 400 }); }
  const payload = await env.CORECARE_PLATFORM_PORTAL.verifyMfa({ ...input, ip: request.headers.get("cf-connecting-ip") || "website", userAgent: request.headers.get("user-agent") || "CoreCare-Website/1.0" });
  if (String(payload.code || "") === "PASSWORD_CHANGE_REQUIRED" && payload.setup) return Response.json({ ok: true, stage: "password", setup: payload.setup, recoveryCodes: payload.recoveryCodes || [] }, { status: 202 });
  return portalResult(payload, Number(payload.status || 200));
}

async function handlePasswordSetup(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Use POST to finish account setup." }, { status: 405, headers: { Allow: "POST" } });
  let input: Record<string, unknown>; try { input = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Enter and confirm your new password." }, { status: 400 }); }
  const payload = await env.CORECARE_PLATFORM_PORTAL.completePasswordSetup({ ...input, ip: request.headers.get("cf-connecting-ip") || "website", userAgent: request.headers.get("user-agent") || "CoreCare-Website/1.0" });
  return portalResult(payload, Number(payload.status || 200));
}

function portalResult(payload: Record<string, unknown>, status: number): Response {
  if (payload.ok !== true) {
    const code = String(payload.code || "INVALID_CREDENTIALS");
    const messages: Record<string, string> = {
      PASSWORD_CHANGE_REQUIRED: "Change the temporary password from your account invitation before opening a product.",
      MFA_REQUIRED: "Complete the account security check before opening a product.",
      NO_PRODUCT_ACCESS: "This account does not currently have an available CoreCare product.",
      PRODUCT_DISABLED: "That CoreCare product is not available yet.",
      PRODUCT_LOGIN_NOT_READY: "Your product access exists, but its One Login handoff is not ready yet.",
    };
    return Response.json({ error: String(payload.message || messages[code] || "The email address or password is incorrect."), code }, { status: status === 429 ? 429 : status >= 500 ? 503 : status >= 400 ? status : 401 });
  }

  const { ready: choices, unavailable } = normalisePortalMatches(payload);
  if (!choices.length && unavailable.length) {
    const names = unavailable.map((item: { name: string }) => item.name).join(", ");
    return Response.json({
      error: `Your account has access to ${names}, but its One Login handoff is not ready. No access has been removed.`,
      code: "PRODUCT_LOGIN_NOT_READY",
      unavailableProducts: unavailable,
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!choices.length) return Response.json({ error: "This account does not currently have an available CoreCare product.", code: "NO_PRODUCT_ACCESS" }, { status: 403 });

  const common = { unavailableProducts: unavailable, recoveryCodes: payload.recoveryCodes || [] };
  return choices.length === 1
    ? Response.json({ ok: true, handoff: choices[0], choices: [], ...common })
    : Response.json({ ok: true, choices, products: choices, ...common });
}

function withProductionHeaders(request: Request, response: Response) {
  const url = new URL(request.url);
  const result = new Response(response.body, response);
  const headers = result.headers;
  const html = (headers.get("content-type") || "").includes("text/html");
  const nonce = html ? crypto.randomUUID().replaceAll("-", "") : "";
  const production = url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://*.corecaresystems.co.uk",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}' 'strict-dynamic'` : ""} https://challenges.cloudflare.com`,
    "script-src-attr 'none'",
    "connect-src 'self' https://*.corecaresystems.co.uk https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
  ];
  if (production) directives.push("upgrade-insecure-requests");
  headers.set("Content-Security-Policy", directives.join("; "));
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (production) headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  if (url.pathname.startsWith("/api/") || ["/login", "/trial/status"].includes(url.pathname)) {
    headers.set("Cache-Control", "no-store");
  } else if (
    url.pathname.startsWith(`${PUBLIC_ASSET_PREFIX}/assets/`) ||
    /^\/(?:_next\/static|assets)\//.test(url.pathname)
  ) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if ((headers.get("content-type") || "").includes("text/html")) {
    headers.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  }
  if (!html || request.method === "HEAD" || !result.body) return result;
  return new HTMLRewriter().on("script", {
    element(element) {
      element.setAttribute("nonce", nonce);
    },
  }).transform(result);
}

export default worker;
