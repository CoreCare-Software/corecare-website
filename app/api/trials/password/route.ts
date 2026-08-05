import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trialRequests } from "../../../../db/schema";
import { readJsonObject } from "../../_shared/body";
import { allowFormRequest, recordEvent, requestAutomation, validSameOriginRequest } from "../../_shared/forms";

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

function safeWorkspaceUrl(value: unknown) {
  try {
    const url = new URL(clean(value, 2_000));
    return url.protocol === "https:" ? url.toString() : "";
  } catch { return ""; }
}

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  const rate = await allowFormRequest(request, "trial-password", 8, 30);
  if (!rate.allowed) return Response.json({ error: "Too many password attempts were made. Please wait and try again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
  const parsed = await readJsonObject(request, 8_192);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  const token = clean(input.token, 160);
  const password = String(input.password || "");
  if (token.length < 40) return Response.json({ error: "Trial not found." }, { status: 404 });
  if (password.length < 12 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return Response.json({ error: "Use 12–128 characters with an upper-case letter, lower-case letter and number." }, { status: 400 });
  }

  const db = getDb();
  const rows = await db.select().from(trialRequests).where(eq(trialRequests.accessToken, token)).limit(1);
  const trial = rows[0];
  if (!trial) return Response.json({ error: "Trial not found." }, { status: 404 });
  if (trial.credentialsSetAt && trial.status === "active") return Response.json({ ok: true, alreadyActive: true, workspaceUrl: trial.workspaceUrl });
  if (!trial.automationToken || trial.status !== "requested") return Response.json({ error: "This trial cannot be activated from this link." }, { status: 409 });

  let response: Response;
  try {
    response = await requestAutomation("trial-password", { automationToken: trial.automationToken, password });
  } catch {
    return Response.json({ error: "Your workspace is still being prepared. Please try again shortly." }, { status: 503 });
  }
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) return Response.json({ error: clean(result.error, 300) || "Your workspace could not be activated yet." }, { status: response.status });

  const now = new Date();
  const start = clean(result.trialStartedAt, 40) || now.toISOString();
  const end = clean(result.trialEndsAt, 40) || new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const workspaceUrl = safeWorkspaceUrl(result.workspaceUrl) || trial.workspaceUrl;
  await db.update(trialRequests).set({
    status: "active",
    provisioningStatus: "complete",
    provisioningError: null,
    workspaceUrl,
    activatedAt: start,
    credentialsSetAt: now.toISOString(),
    trialStartedAt: start,
    trialEndsAt: end,
    updatedAt: now.toISOString(),
  }).where(eq(trialRequests.id, trial.id));
  await recordEvent("trial_activated", { productCode: trial.productCode, path: "/trial/status", outcome: "complete" });
  return Response.json({ ok: true, workspaceUrl, trialStartedAt: start, trialEndsAt: end });
}
