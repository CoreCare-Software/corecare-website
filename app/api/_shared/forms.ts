import { env } from "cloudflare:workers";

const productionHosts = new Set(["corecaresystems.co.uk", "www.corecaresystems.co.uk"]);

export function validSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    if (source.origin === target.origin) return true;
    return productionHosts.has(source.hostname) && productionHosts.has(target.hostname);
  } catch { return false; }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function allowFormRequest(request: Request, purpose: string, limit = 6, windowMinutes = 15) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = await sha256(`${purpose}|${ip}`);
  const windowMs = windowMinutes * 60_000;
  const now = Date.now();
  const existing = await env.DB.prepare("SELECT request_count, window_started_at FROM form_rate_limits WHERE key = ?").bind(key).first<{ request_count: number; window_started_at: string }>();
  const started = existing?.window_started_at ? new Date(existing.window_started_at).getTime() : 0;
  const withinWindow = Number.isFinite(started) && now - started < windowMs;
  const count = withinWindow ? Number(existing?.request_count || 0) + 1 : 1;
  const windowStartedAt = withinWindow ? existing!.window_started_at : new Date(now).toISOString();
  await env.DB.prepare(`INSERT INTO form_rate_limits (key, request_count, window_started_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET request_count = excluded.request_count, window_started_at = excluded.window_started_at, updated_at = CURRENT_TIMESTAMP`)
    .bind(key, count, windowStartedAt).run();
  return { allowed: count <= limit, retryAfter: Math.max(1, Math.ceil((windowMs - (now - new Date(windowStartedAt).getTime())) / 1000)) };
}

export async function recordEvent(eventName: string, details: { productCode?: string; path?: string; outcome?: string } = {}) {
  try {
    await env.DB.prepare("INSERT INTO analytics_events (id, event_name, product_code, path, outcome) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), eventName.slice(0, 80), details.productCode?.slice(0, 20) || null, details.path?.slice(0, 200) || "", details.outcome?.slice(0, 80) || "").run();
  } catch {
    // Analytics must never stop a customer journey during a migration or service interruption.
  }
}

type ServiceBinding = { fetch(request: Request): Promise<Response> };

export async function requestAutomation(kind: "trial" | "trial-password" | "trial-checkout" | "trial-billing-status" | "contact", payload: Record<string, unknown>) {
  const runtime = env as unknown as { CORECARE_PLATFORM_AUTOMATION?: ServiceBinding };
  if (!runtime.CORECARE_PLATFORM_AUTOMATION?.fetch) throw new Error("automation_not_configured");
  return runtime.CORECARE_PLATFORM_AUTOMATION.fetch(new Request("https://platform-automation.internal/api/public/automation", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "corecare-systems-website/1.0" },
    body: JSON.stringify({ kind, ...payload }),
  }));
}

export async function dispatchAutomation(kind: "trial" | "trial-checkout" | "trial-billing-status" | "contact", payload: Record<string, unknown>) {
  const response = await requestAutomation(kind, payload);
  if (!response.ok) throw new Error(`automation_${response.status}`);
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { dispatched: true as const, result };
}
