/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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
    let response: Response;

    if (url.pathname === "/_vinext/image") {
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
