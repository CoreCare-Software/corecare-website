import { env } from "cloudflare:workers";

const clean = (value: unknown, max = 2_048) => String(value ?? "").trim().slice(0, max);

type TurnstileResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

async function readBoundedJson(response: Response, maxBytes = 32_768): Promise<TurnstileResult> {
  if (!response.body) return {};
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("turnstile_response_too_large");
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body) as TurnstileResult;
  } finally {
    reader.releaseLock();
  }
}

export async function verifyTurnstile(request: Request, token: unknown, expectedAction: string) {
  const runtime = env as unknown as Record<string, unknown>;
  const secret = clean(runtime.TURNSTILE_SECRET, 4_096);
  const expectedHostnames = new Set(clean(runtime.TURNSTILE_HOSTNAMES, 2_048)
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean));
  const responseToken = clean(token);
  if (!secret || !responseToken || String(token ?? "").length > 2_048 || expectedHostnames.size === 0) return false;

  const clientIp = clean(request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0], 64);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: responseToken,
        ...(clientIp ? { remoteip: clientIp } : {}),
      }),
    });
    if (!response.ok) return false;
    const result = await readBoundedJson(response);
    return result.success === true
      && result.action === expectedAction
      && expectedHostnames.has(clean(result.hostname, 253).toLowerCase());
  } catch {
    return false;
  }
}

export function turnstileRejected() {
  return Response.json({ error: "Complete the security verification and try again." }, {
    status: 403,
    headers: { "cache-control": "no-store" },
  });
}
