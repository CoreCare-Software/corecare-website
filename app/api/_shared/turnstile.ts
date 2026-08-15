import { env } from "cloudflare:workers";

const clean = (value: unknown, max = 2_048) => String(value ?? "").trim().slice(0, max);

type TurnstileResult = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: unknown;
  metadata?: { result_with_testing_key?: boolean };
};

export type TurnstileFailureReason =
  | "missing_response"
  | "invalid_response"
  | "expired_or_duplicate"
  | "configuration"
  | "provider_unavailable"
  | "provider_rejected"
  | "action_mismatch"
  | "hostname_mismatch";

export type TurnstileVerification =
  | { ok: true; action: string; hostname: string }
  | { ok: false; reason: TurnstileFailureReason };

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

function providerFailureReason(result: TurnstileResult): TurnstileFailureReason {
  const errorCodes = Array.isArray(result["error-codes"])
    ? result["error-codes"].map((value) => clean(value, 80)).filter(Boolean)
    : [];

  if (errorCodes.includes("missing-input-secret") || errorCodes.includes("invalid-input-secret")) {
    return "configuration";
  }
  if (errorCodes.includes("timeout-or-duplicate")) return "expired_or_duplicate";
  if (errorCodes.includes("missing-input-response") || errorCodes.includes("invalid-input-response")) {
    return "invalid_response";
  }
  if (errorCodes.includes("internal-error")) return "provider_unavailable";
  return "provider_rejected";
}

export async function verifyTurnstileDetailed(
  request: Request,
  token: unknown,
  expectedAction: string,
  suppliedRuntime?: Record<string, unknown>,
): Promise<TurnstileVerification> {
  const runtime = suppliedRuntime || (env as unknown as Record<string, unknown>);
  const secret = clean(runtime.TURNSTILE_SECRET, 4_096);
  const expectedHostnames = new Set(clean(runtime.TURNSTILE_HOSTNAMES, 2_048)
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean));
  const originalToken = String(token ?? "");
  const responseToken = clean(token);

  if (!responseToken) return { ok: false, reason: "missing_response" };
  if (originalToken.length > 2_048) return { ok: false, reason: "invalid_response" };
  if (!secret || expectedHostnames.size === 0) return { ok: false, reason: "configuration" };

  let requestHostname = "";
  try {
    requestHostname = new URL(request.url).hostname.toLowerCase();
  } catch {
    return { ok: false, reason: "hostname_mismatch" };
  }
  if (!expectedHostnames.has(requestHostname)) return { ok: false, reason: "hostname_mismatch" };

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret,
        response: responseToken,
        idempotency_key: crypto.randomUUID(),
      }),
    });
    if (!response.ok) return { ok: false, reason: "provider_unavailable" };

    const result = await readBoundedJson(response);
    const providerAccepted = result.success === true;
    if (!providerAccepted) return { ok: false, reason: providerFailureReason(result) };

    // Cloudflare's official test secret keys (see
    // https://developers.cloudflare.com/turnstile/troubleshooting/testing/)
    // echo a fixed hostname ("example.com") and omit `action` because the
    // dummy token carries no real challenge context. `result.metadata.result_with_testing_key`
    // is set only by Cloudflare itself when the *secret* we sent is one of its
    // documented test secrets — it cannot be forged by a client-supplied
    // token, so trusting it does not weaken verification. Production never
    // configures a test secret, so this branch can never be reached there.
    // The request's own hostname must still be in this environment's
    // configured allowlist either way.
    const usedTestKey = result.metadata?.result_with_testing_key === true;

    const action = clean(result.action, 80);
    const hostname = usedTestKey ? requestHostname : clean(result.hostname, 253).toLowerCase();
    const expectedActionMatched = usedTestKey || result.action === expectedAction;
    if (!expectedActionMatched) return { ok: false, reason: "action_mismatch" };
    if (!expectedHostnames.has(hostname) || hostname !== requestHostname) {
      return { ok: false, reason: "hostname_mismatch" };
    }
    return { ok: true, action, hostname };
  } catch {
    return { ok: false, reason: "provider_unavailable" };
  }
}

export async function verifyTurnstile(
  request: Request,
  token: unknown,
  expectedAction: string,
  suppliedRuntime?: Record<string, unknown>,
) {
  return (await verifyTurnstileDetailed(request, token, expectedAction, suppliedRuntime)).ok;
}

export function turnstileRejected(
  verification: TurnstileVerification = { ok: false, reason: "provider_rejected" },
  requestId = "",
) {
  const reason = verification.ok ? "provider_rejected" : verification.reason;
  const temporary = reason === "configuration" || reason === "provider_unavailable";
  const expired = reason === "expired_or_duplicate";
  const error = temporary
    ? "Security verification is temporarily unavailable. Please try again."
    : expired
      ? "The security verification expired. Complete it again and retry."
      : "Complete the security verification and try again.";
  const code = temporary
    ? "SECURITY_VERIFICATION_UNAVAILABLE"
    : expired
      ? "SECURITY_VERIFICATION_EXPIRED"
      : "SECURITY_VERIFICATION_REJECTED";
  const headers = new Headers({ "cache-control": "no-store" });
  if (requestId) headers.set("x-request-id", requestId);

  return Response.json({ error, code, ...(requestId ? { requestId } : {}) }, {
    status: temporary ? 503 : 403,
    headers,
  });
}
