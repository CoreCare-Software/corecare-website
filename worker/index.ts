/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

const PUBLIC_ASSET_PREFIX = "/_corecare-static";

const FORM_QUERY_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "/login": ["email", "password", "productCode"],
  "/trial": ["contactName", "email", "companyName", "phone", "teamSize", "productCode", "privacyAccepted", "website"],
  "/contact": ["contactName", "email", "companyName", "productCode", "message", "privacyAccepted", "website"],
  "/account-help": ["contactName", "email", "companyName", "productCode", "privacyAccepted", "website"],
  "/data-rights": ["requesterName", "requesterEmail", "organisationName", "relationship", "requestType", "productCode", "requestSummary", "privacyAccepted", "website"],
  "/trial/status": ["password", "confirmPassword"],
});

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
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

    if (url.pathname.startsWith(`${PUBLIC_ASSET_PREFIX}/assets/`)) {
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
  },
};

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
