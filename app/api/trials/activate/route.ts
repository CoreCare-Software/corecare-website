import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trialRequests } from "../../../../db/schema";
import { findTrialByAutomationToken } from "../../../../db/trial-capabilities";
import { readJsonObject } from "../../_shared/body";

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

function safeWorkspaceUrl(value: unknown) {
  const candidate = clean(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const parsed = await readJsonObject(request, 16_384);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  const automationToken = clean(input.automationToken, 160);
  const requestedStatus = clean(input.status, 30).toLowerCase();
  const allowedStatuses = new Set(["active", "failed", "expired", "converted"]);
  if (automationToken.length < 40 || !allowedStatuses.has(requestedStatus)) {
    return Response.json({ error: "A valid trial token and status are required." }, { status: 400 });
  }

  const db = getDb();
  const trial = await findTrialByAutomationToken(automationToken);
  if (!trial) return Response.json({ error: "Trial request not found." }, { status: 404 });

  const now = new Date();
  const activatedAt = requestedStatus === "active" ? clean(input.activatedAt, 40) || now.toISOString() : trial.activatedAt;
  const parsedStart = activatedAt ? new Date(activatedAt) : now;
  const safeStart = Number.isFinite(parsedStart.getTime()) ? parsedStart : now;
  const defaultEnd = new Date(safeStart.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const suppliedEnd = clean(input.trialEndsAt, 40);
  const workspaceUrl = safeWorkspaceUrl(input.workspaceUrl);
  if (clean(input.workspaceUrl) && !workspaceUrl) return Response.json({ error: "Workspace URL must use HTTPS." }, { status: 400 });

  await db.update(trialRequests).set({
    status: requestedStatus,
    provisioningStatus: requestedStatus === "active" ? "complete" : requestedStatus,
    provisioningError: requestedStatus === "failed" ? clean(input.error, 500) || "Provisioning could not be completed." : null,
    workspaceUrl: workspaceUrl || trial.workspaceUrl,
    activatedAt,
    trialStartedAt: requestedStatus === "active" ? safeStart.toISOString() : trial.trialStartedAt,
    trialEndsAt: requestedStatus === "active" ? suppliedEnd || defaultEnd : trial.trialEndsAt,
    updatedAt: now.toISOString(),
  }).where(eq(trialRequests.id, trial.id));

  return Response.json({ ok: true, status: requestedStatus });
}
