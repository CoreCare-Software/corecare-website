import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trialRequests } from "../../../../db/schema";
import { getProduct } from "../../../products";
import { readJsonObject } from "../../_shared/body";
import { dispatchAutomation, validSameOriginRequest } from "../../_shared/forms";

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  try {
    const parsed = await readJsonObject<{ token?: string }>(request, 8_192);
    if (!parsed.ok) return parsed.response;
    const input = parsed.value;
    const token = String(input.token || "").trim().slice(0, 160);
    if (token.length < 40) return Response.json({ error: "Trial not found." }, { status: 404 });
    const rows = await getDb().select({ id: trialRequests.id, companyName: trialRequests.companyName, productCode: trialRequests.productCode, status: trialRequests.status, trialStartedAt: trialRequests.trialStartedAt, trialEndsAt: trialRequests.trialEndsAt, workspaceUrl: trialRequests.workspaceUrl, provisioningStatus: trialRequests.provisioningStatus, provisioningError: trialRequests.provisioningError, credentialsSetAt: trialRequests.credentialsSetAt, automationToken: trialRequests.automationToken, checkoutSessionId: trialRequests.checkoutSessionId, convertedAt: trialRequests.convertedAt }).from(trialRequests).where(eq(trialRequests.accessToken, token)).limit(1);
    const row = rows[0];
    if (!row) return Response.json({ error: "Trial not found." }, { status: 404 });
    const endTime = row.trialEndsAt ? new Date(row.trialEndsAt).getTime() : 0;
    const expired = Boolean(endTime && endTime <= Date.now());
    let status = expired && row.status === "active" ? "expired" : row.status;
    const daysRemaining = endTime && !expired ? Math.max(0, Math.ceil((endTime - Date.now()) / 86_400_000)) : 0;
    let billing: Record<string, unknown> = { available: false, mode: "unavailable", plans: [] };
    if (row.automationToken) {
      try {
        const dispatched = await dispatchAutomation("trial-billing-status", { automationToken: row.automationToken, checkoutSessionId: row.checkoutSessionId || undefined });
        billing = (dispatched.result.billing || billing) as Record<string, unknown>;
        const access = billing.access as { subscriptionStatus?: string } | undefined;
        if (["active", "trial"].includes(String(access?.subscriptionStatus || "")) && row.checkoutSessionId) {
          status = "converted";
          if (!row.convertedAt) await getDb().update(trialRequests).set({ status: "converted", convertedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(trialRequests.id, row.id));
        }
      } catch {
        billing = { available: false, mode: "unavailable", plans: [] };
      }
    }
    const product = getProduct(row.productCode);
    return Response.json({ trial: { companyName: row.companyName, status, startsAt: row.trialStartedAt || null, endsAt: row.trialEndsAt || null, daysRemaining, provisioningStatus: row.provisioningStatus, provisioningError: row.provisioningError, needsPassword: status === "requested" && !row.credentialsSetAt && ["awaiting_credentials", "ready", "dispatched"].includes(row.provisioningStatus) }, product: product ? { code: product.code, name: product.name, liveUrl: row.workspaceUrl || product.liveUrl } : null, billing });
  } catch { return Response.json({ error: "We could not load this trial." }, { status: 500 }); }
}
