import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trialRequests } from "../../../../db/schema";
import { readJsonObject } from "../../_shared/body";
import { allowFormRequest, dispatchAutomation, recordEvent, validSameOriginRequest } from "../../_shared/forms";
import { automationTokenForTrial, findTrialByStatusToken } from "../../../../db/trial-capabilities";

function safeStripeCheckoutUrl(value: unknown) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "checkout.stripe.com" || url.hostname.endsWith(".stripe.com")) ? url.toString() : "";
  } catch { return ""; }
}

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const rate = await allowFormRequest(request, "trial-checkout", 5, 15);
  if (!rate.allowed) return Response.json({ error: "Please wait before trying checkout again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
  try {
    const parsed = await readJsonObject<{ token?: string; planId?: string }>(request, 8_192);
    if (!parsed.ok) return parsed.response;
    const input = parsed.value;
    const token = String(input.token || "").trim().slice(0, 160);
    const planId = ["limited", "unlimited"].includes(String(input.planId || "").toLowerCase()) ? String(input.planId).toLowerCase() : "limited";
    if (token.length < 40) return Response.json({ error: "Trial not found." }, { status: 404 });
    const trial = await findTrialByStatusToken(token);
    if (!trial) return Response.json({ error: "Trial not found." }, { status: 404 });
    const automationToken = await automationTokenForTrial(trial);
    if (!automationToken) return Response.json({ error: "Trial not found." }, { status: 404 });
    const trialEnd = new Date(trial.trialEndsAt || 0);
    if (!trial.credentialsSetAt || !Number.isFinite(trialEnd.getTime())) return Response.json({ error: "Activate the trial workspace before choosing a subscription." }, { status: 409 });
    if (trialEnd.getTime() > Date.now()) return Response.json({ error: "Your free trial is still active. Checkout becomes available when it ends." }, { status: 409 });
    const dispatched = await dispatchAutomation("trial-checkout", { automationToken, statusToken: token, planId });
    const result = dispatched.result as { url?: unknown; sessionId?: unknown; mode?: unknown; plan?: unknown; error?: unknown };
    const url = safeStripeCheckoutUrl(result.url);
    const sessionId = String(result.sessionId || "").trim().slice(0, 255);
    const mode = result.mode === "live" ? "live" : result.mode === "test" ? "test" : "";
    if (!url || !sessionId || !mode) return Response.json({ error: String(result.error || "Secure Stripe checkout is not ready yet.") }, { status: 502 });
    await getDb().update(trialRequests).set({ checkoutSessionId: sessionId, updatedAt: new Date().toISOString() }).where(eq(trialRequests.id, trial.id));
    await recordEvent(`trial_${mode}_checkout_started`, { productCode: trial.productCode, path: "/trial/status", outcome: planId });
    return Response.json({ ok: true, url, sessionId, mode, plan: result.plan });
  } catch {
    return Response.json({ error: "Secure Stripe checkout is not connected yet." }, { status: 503 });
  }
}
