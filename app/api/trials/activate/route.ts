import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trialRequests } from "../../../../db/schema";

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
  const input = await request.json() as Record<string, unknown>;
  const automationToken = clean(input.automationToken, 160);
  const requestedStatus = clean(input.status, 30).toLowerCase();
  const allowedStatuses = new Set(["active", "failed", "expired", "converted"]);
  if (automationToken.length < 40 || !allowedStatuses.has(requestedStatus)) {
    return Response.json({ error: "A valid trial token and status are required." }, { status: 400 });
  }

  const db = getDb();
  const current = await db.select().from(trialRequests).where(eq(trialRequests.automationToken, automationToken)).limit(1);
  if (!current[0]) return Response.json({ error: "Trial request not found." }, { status: 404 });

  const now = new Date();
  const activatedAt = requestedStatus === "active" ? clean(input.activatedAt, 40) || now.toISOString() : current[0].activatedAt;
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
    workspaceUrl: workspaceUrl || current[0].workspaceUrl,
    activatedAt,
    trialStartedAt: requestedStatus === "active" ? safeStart.toISOString() : current[0].trialStartedAt,
    trialEndsAt: requestedStatus === "active" ? suppliedEnd || defaultEnd : current[0].trialEndsAt,
    updatedAt: now.toISOString(),
  }).where(eq(trialRequests.id, current[0].id));

  return Response.json({ ok: true, status: requestedStatus });
}
