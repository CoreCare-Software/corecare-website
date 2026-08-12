/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { allowFormRequest, recordEvent, validSameOriginRequest } from "../app/api/_shared/forms";
import { turnstileRejected, verifyTurnstile, verifyTurnstileDetailed } from "../app/api/_shared/turnstile";
import { recordRuntimeError } from "./runtime-errors";
import { normalisePortalMatches } from "./portal-matches.js";

const PUBLIC_ASSET_PREFIX = "/_corecare-static";
const STAGING_WEBSITE_HOST = "corecare-website-staging.cselectricalservices11.workers.dev";
const STAGING_HANDOFF_ORIGINS = Object.freeze([
  "https://corecare-care-staging.cselectricalservices11.workers.dev",
  "https://corecare-campsite-staging.cselectricalservices11.workers.dev",
  "https://corecare-finance-staging.cselectricalservices11.workers.dev",
  "https://corecare-garage-staging.cselectricalservices11.workers.dev",
  "https://corecare-marketing-staging.cselectricalservices11.workers.dev",
  "https://corecare-pos-staging.cselectricalservices11.workers.dev",
]);
const PRODUCTION_HANDOFF_ORIGINS = Object.freeze([
  "https://care.corecaresystems.co.uk",
  "https://campsites.corecaresystems.co.uk",
  "https://finance.corecaresystems.co.uk",
  "https://garage.corecaresystems.co.uk",
  "https://marketing.corecaresystems.co.uk",
  "https://pos.corecaresystems.co.uk",
]);

function websiteEnvironment(request: Request): "production" | "staging" {
  return new URL(request.url).hostname === STAGING_WEBSITE_HOST
    ? "staging"
    : "production";
}

interface PortalBinding extends Fetcher {
  verifyMfa(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  completePasswordSetup(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  authorizeMobile(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  redeemProductChooser(input: Record<string, unknown>): Promise<Record<string, unknown>>;
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
    const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
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

      if (url.pathname === "/api/mobile-token") {
        response = await handleMobileBrokerRequest(request, env, "/api/mobile/auth/token");
      } else if (url.pathname === "/api/mobile-select") {
        response = await handleMobileBrokerRequest(request, env, "/api/mobile/auth/select");
      } else if (url.pathname === "/api/login") {
        response = await handleOneLogin(request, env);
      } else if (url.pathname === "/api/mobile-login") {
        response = await handleMobileLogin(request, env, requestId);
      } else if (url.pathname === "/api/login/mfa") {
        response = await handleMfa(request, env);
      } else if (url.pathname === "/api/login/password") {
        response = await handlePasswordSetup(request, env);
      } else if (url.pathname === "/api/login/switch") {
        response = await handleProductChooser(request, env);
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
      await recordRuntimeError(env, { requestId, productCode: "WEBSITE", route: url.pathname, method: request.method, statusCode: 500, error });
      return withProductionHeaders(request, Response.json({ error: "CoreCare could not complete this request.", requestId }, {
        status: 500,
        headers: { "cache-control": "no-store", "x-request-id": requestId },
      }));
    }
  },
};

const MOBILE_CLIENT_ID = "uk.co.corecaresystems.app";
const MOBILE_REDIRECT_URI = "uk.co.corecaresystems.app://auth/callback";
const MOBILE_CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const MOBILE_STATE_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

function mobileJson(payload: Record<string, unknown>, status = 200, requestId = ""): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  if (requestId) headers.set("x-request-id", requestId);
  return Response.json({ ...payload, ...(requestId ? { requestId } : {}) }, { status, headers });
}

function validatedMobileCallback(value: unknown, expectedState: string): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "uk.co.corecaresystems.app:" ||
      url.hostname !== "auth" ||
      url.pathname !== "/callback" ||
      url.searchParams.get("state") !== expectedState ||
      !url.searchParams.get("code")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function handleMobileLogin(request: Request, env: Env, requestId: string): Promise<Response> {
  if (request.method !== "POST") return mobileJson({ error: "Use POST to sign in." }, 405, requestId);
  if (!validSameOriginRequest(request)) {
    return mobileJson({ error: "This mobile sign-in request could not be verified." }, 403, requestId);
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) return mobileJson({ error: "The sign-in request is too large." }, 413, requestId);
  if (typeof env.CORECARE_PLATFORM_PORTAL?.authorizeMobile !== "function") {
    return mobileJson({ error: "CoreCare Mobile sign-in is temporarily unavailable." }, 503, requestId);
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json() as Record<string, unknown>;
  } catch {
    return mobileJson({ error: "The mobile sign-in request was invalid." }, 400, requestId);
  }

  const turnstile = await verifyTurnstileDetailed(request, input.turnstileToken, "login");
  if (!turnstile.ok) {
    await recordEvent("mobile_login_turnstile", {
      path: "/mobile-login",
      outcome: turnstile.reason,
    });
    return turnstileRejected(turnstile, requestId);
  }

  const rate = await allowFormRequest(request, "mobile-login-portal", 10, 15);
  if (!rate.allowed) {
    return mobileJson({
      error: "Too many sign-in attempts were made from this connection. Please wait and try again.",
    }, 429, requestId);
  }

  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const codeChallenge = typeof input.codeChallenge === "string" ? input.codeChallenge : "";
  const state = typeof input.state === "string" ? input.state : "";
  const validRequest =
    input.clientId === MOBILE_CLIENT_ID &&
    input.redirectUri === MOBILE_REDIRECT_URI &&
    input.codeChallengeMethod === "S256" &&
    MOBILE_CODE_CHALLENGE_PATTERN.test(codeChallenge) &&
    MOBILE_STATE_PATTERN.test(state) &&
    email.length > 3 &&
    email.length <= 254 &&
    password.length > 0 &&
    password.length <= 1024;

  if (!validRequest) return mobileJson({ error: "The mobile sign-in request was invalid." }, 400, requestId);

  let result: Record<string, unknown>;
  try {
    result = await env.CORECARE_PLATFORM_PORTAL.authorizeMobile({
      clientId: MOBILE_CLIENT_ID,
      redirectUri: MOBILE_REDIRECT_URI,
      codeChallenge,
      codeChallengeMethod: "S256",
      state,
      email,
      password,
      requestedProduct: "CARE",
      ip: request.headers.get("cf-connecting-ip") || "website",
      userAgent: request.headers.get("user-agent") || "CoreCare-Website/1.0",
    });
  } catch {
    await recordEvent("mobile_login_authorisation", { path: "/mobile-login", outcome: "unavailable" });
    return mobileJson({ error: "CoreCare Mobile sign-in is temporarily unavailable." }, 503, requestId);
  }

  if (result.ok !== true) {
    const reportedCode = typeof result.code === "string" ? result.code : "";
    const allowedCodes = new Set(["INVALID_CREDENTIALS", "MFA_REQUIRED", "PASSWORD_CHANGE_REQUIRED", "NO_PRODUCT_ACCESS"]);
    const code = allowedCodes.has(reportedCode) ? reportedCode : "SIGN_IN_FAILED";
    const messages: Record<string, string> = {
      INVALID_CREDENTIALS: "The email address or password was not recognised.",
      MFA_REQUIRED: "This account requires additional verification that CoreCare Mobile does not support yet. No sign-in was completed.",
      PASSWORD_CHANGE_REQUIRED: "Finish setting up your CoreCare password before signing in to CoreCare Mobile.",
      NO_PRODUCT_ACCESS: "This account does not currently have an available CoreCare product.",
      SIGN_IN_FAILED: "CoreCare could not complete this mobile sign-in.",
    };
    await recordEvent("mobile_login_authorisation", { path: "/mobile-login", outcome: code });
    return mobileJson({ ok: false, code, error: messages[code] }, code === "INVALID_CREDENTIALS" ? 401 : 403, requestId);
  }

  const redirectUrl = validatedMobileCallback(result.redirectUrl, state);
  if (!redirectUrl) {
    await recordEvent("mobile_login_authorisation", { path: "/mobile-login", outcome: "invalid_callback" });
    return mobileJson({ error: "CoreCare returned an invalid mobile handoff." }, 502, requestId);
  }

  await recordEvent("mobile_login_authorisation", { path: "/mobile-login", outcome: "authorised" });
  return mobileJson({ ok: true, redirectUrl, expiresAt: result.expiresAt }, 200, requestId);
}

function mobileTransportHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, x-corecare-mobile-client",
    "access-control-expose-headers": "content-type",
    "access-control-max-age": "600",
    "cache-control": "no-store",
    "cross-origin-resource-policy": "cross-origin",
    "referrer-policy": "no-referrer",
    "vary": "Origin",
    "x-content-type-options": "nosniff",
  };
}

function mobileTransportOrigin(request: Request): string | null {
  const origin = request.headers.get("origin") || "";
  if (origin === "capacitor://localhost") return origin;
  if (!origin && request.headers.get("x-corecare-mobile-client") === MOBILE_CLIENT_ID) {
    return "capacitor://localhost";
  }
  return null;
}

async function handleMobileBrokerRequest(
  request: Request,
  env: Env,
  platformPath: "/api/mobile/auth/token" | "/api/mobile/auth/select",
): Promise<Response> {
  const origin = mobileTransportOrigin(request);
  if (!origin) return mobileJson({ error: "This Mobile authorization request could not be verified." }, 403);
  const headers = mobileTransportHeaders(origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return Response.json({ error: "Use POST." }, { status: 405, headers });
  if (request.headers.get("x-corecare-mobile-client") !== MOBILE_CLIENT_ID) {
    return Response.json({ error: "The Mobile client is not registered." }, { status: 401, headers });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 16_384) return Response.json({ error: "The Mobile authorization request is too large." }, { status: 413, headers });
  const raw = await request.text();
  if (raw.length > 16_384) return Response.json({ error: "The Mobile authorization request is too large." }, { status: 413, headers });
  let input: Record<string, unknown>;
  try { input = JSON.parse(raw || "{}") as Record<string, unknown>; }
  catch { return Response.json({ error: "The Mobile authorization request is invalid." }, { status: 400, headers }); }
  if (input.clientId !== MOBILE_CLIENT_ID || input.redirectUri !== MOBILE_REDIRECT_URI) {
    return Response.json({ error: "The Mobile client or callback is invalid." }, { status: 400, headers });
  }

  const upstreamHeaders = new Headers({
    "content-type": "application/json",
    accept: "application/json",
    origin,
    "x-corecare-mobile-client": MOBILE_CLIENT_ID,
  });
  const authorization = request.headers.get("authorization");
  if (authorization) upstreamHeaders.set("authorization", authorization);
  const upstream = await env.CORECARE_PLATFORM_PORTAL.fetch(new Request(`https://corecare-platform.internal${platformPath}`, {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify(input),
  }));
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

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
  return portalResult(payload, upstream.status, websiteEnvironment(request));
}

async function handleMfa(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Use POST to verify Authenticator." }, { status: 405, headers: { Allow: "POST" } });
  let input: Record<string, unknown>; try { input = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Enter the current Authenticator code." }, { status: 400 }); }
  const payload = await env.CORECARE_PLATFORM_PORTAL.verifyMfa({ ...input, ip: request.headers.get("cf-connecting-ip") || "website", userAgent: request.headers.get("user-agent") || "CoreCare-Website/1.0" });
  if (String(payload.code || "") === "PASSWORD_CHANGE_REQUIRED" && payload.setup) return Response.json({ ok: true, stage: "password", setup: payload.setup, recoveryCodes: payload.recoveryCodes || [] }, { status: 202 });
  return portalResult(payload, Number(payload.status || 200), websiteEnvironment(request));
}

async function handlePasswordSetup(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Use POST to finish account setup." }, { status: 405, headers: { Allow: "POST" } });
  let input: Record<string, unknown>; try { input = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: "Enter and confirm your new password." }, { status: 400 }); }
  const payload = await env.CORECARE_PLATFORM_PORTAL.completePasswordSetup({ ...input, ip: request.headers.get("cf-connecting-ip") || "website", userAgent: request.headers.get("user-agent") || "CoreCare-Website/1.0" });
  return portalResult(payload, Number(payload.status || 200), websiteEnvironment(request));
}

async function handleProductChooser(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Use POST to open the product chooser." }, { status: 405, headers: { Allow: "POST" } });
  if (!validSameOriginRequest(request)) return Response.json({ error: "This product switch request could not be verified." }, { status: 403 });
  if (typeof env.CORECARE_PLATFORM_PORTAL?.redeemProductChooser !== "function") {
    return Response.json({ error: "CoreCare product switching is temporarily unavailable." }, { status: 503 });
  }
  if (Number(request.headers.get("content-length") || 0) > 4_096) {
    return Response.json({ error: "This product switch request is too large." }, { status: 413 });
  }
  const rate = await allowFormRequest(request, "central-product-chooser", 30, 15);
  if (!rate.allowed) return Response.json({ error: "Too many product switch requests were received. Wait and try again." }, {
    status: 429,
    headers: { "retry-after": String(rate.retryAfter), "cache-control": "no-store" },
  });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "This product chooser link is invalid." }, { status: 400 }); }
  const ticket = typeof input.ticket === "string" ? input.ticket : "";
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(ticket)) {
    return Response.json({ error: "This product chooser link is invalid." }, { status: 400 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = await env.CORECARE_PLATFORM_PORTAL.redeemProductChooser({
      ticket,
      ip: request.headers.get("cf-connecting-ip") || "website",
      userAgent: request.headers.get("user-agent") || "CoreCare-Website/1.0",
    });
  } catch {
    return Response.json({ error: "CoreCare product switching is temporarily unavailable." }, { status: 503 });
  }
  const status = Number(payload.status || (payload.ok === true ? 200 : 403));
  await recordEvent("central_product_chooser", {
    path: "/login",
    outcome: payload.ok === true ? "ready" : String(payload.code || status),
  });
  return portalResult(payload, status, websiteEnvironment(request), true);
}

function portalResult(
  payload: Record<string, unknown>,
  status: number,
  environment: "production" | "staging",
  forceChooser = false,
): Response {
  if (payload.ok !== true) {
    const code = String(payload.code || "INVALID_CREDENTIALS");
    const messages: Record<string, string> = {
      PASSWORD_CHANGE_REQUIRED: "Change the temporary password from your account invitation before opening a product.",
      MFA_REQUIRED: "Complete the account security check before opening a product.",
      NO_PRODUCT_ACCESS: "This account does not currently have an available CoreCare product.",
      PRODUCT_DISABLED: "That CoreCare product is not available yet.",
      PRODUCT_LOGIN_NOT_READY: "Your product access exists, but its One Login handoff is not ready yet.",
      CHOOSER_TICKET_INVALID: "This product chooser link is invalid. Return to your current product and select Switch products again.",
      CHOOSER_TICKET_EXPIRED: "This product chooser link has expired. Return to your current product and select Switch products again.",
      CHOOSER_TICKET_REPLAYED: "This product chooser link has already been used. Return to your current product and select Switch products again.",
      INVALID_SESSION: "Your central CoreCare session is no longer valid. Sign in again to continue.",
    };
    return Response.json({ error: String(payload.message || messages[code] || "The email address or password is incorrect."), code }, { status: status === 429 ? 429 : status >= 500 ? 503 : status >= 400 ? status : 401 });
  }

  const { ready: choices, unavailable } = normalisePortalMatches(payload, environment);
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
  return choices.length === 1 && !forceChooser
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
    `form-action 'self' ${
      websiteEnvironment(request) === "staging"
        ? STAGING_HANDOFF_ORIGINS.join(" ")
        : PRODUCTION_HANDOFF_ORIGINS.join(" ")
    }`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self'${nonce ? ` 'nonce-${nonce}' 'strict-dynamic'` : ""} https://challenges.cloudflare.com`,
    "script-src-attr 'none'",
    "connect-src 'self' https://challenges.cloudflare.com",
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
