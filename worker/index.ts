/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

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

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
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
  },
};

async function handleOneLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return Response.json({ error: "Use POST to sign in." }, { status: 405, headers: { Allow: "POST" } });
  if (!env.CORECARE_PLATFORM_PORTAL?.fetch) return Response.json({ error: "CoreCare one-login is not configured." }, { status: 503 });
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "Enter your email address and password." }, { status: 400 }); }
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
    };
    return Response.json({ error: String(payload.message || messages[code] || "The email address or password is incorrect."), code }, { status: status === 429 ? 429 : status >= 500 ? 503 : status >= 400 ? status : 401 });
  }
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const choices = matches.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object") && String((item as Record<string, unknown>).code) !== "MARKETING").map(item => ({
    code: String(item.code || ""), productCode: String(item.code || ""), product: String(item.code || ""),
    name: String(item.name || item.code || "CoreCare"), label: String(item.name || item.code || "CoreCare"),
    description: String(item.description || "Open this CoreCare workspace."),
    action: String(item.action || ""), portalUrl: String(item.action || ""),
    grant: String(item.grant || ""), returnTo: String(item.returnTo || "/"), mfa: item.mfa === true,
    handoffUrl: String(item.action || ""),
  })).filter(item => item.code && item.action && item.grant);
  if (!choices.length) return Response.json({ error: "This account does not currently have an available CoreCare product.", code: "NO_PRODUCT_ACCESS" }, { status: 403 });
  return choices.length === 1
    ? Response.json({ ok: true, handoff: choices[0], choices: [], recoveryCodes: payload.recoveryCodes || [] })
    : Response.json({ ok: true, choices, products: choices, recoveryCodes: payload.recoveryCodes || [] });
}

function withProductionHeaders(request: Request, response: Response) {
  const url = new URL(request.url);
  const result = new Response(response.body, response);
  const headers = result.headers;
  const production = url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self' https://*.workers.dev https://*.corecaresystems.co.uk",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "connect-src 'self' https://*.workers.dev https://*.corecaresystems.co.uk https://challenges.cloudflare.com",
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
  } else if (/^\/(?:_next\/static|assets)\//.test(url.pathname)) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if ((headers.get("content-type") || "").includes("text/html")) {
    headers.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  }
  return result;
}

export default worker;
