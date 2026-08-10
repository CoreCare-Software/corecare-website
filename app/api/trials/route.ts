import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { trialRequests } from "../../../db/schema";
import { getProduct } from "../../products";
import { readJsonObject } from "../_shared/body";
import { allowFormRequest, dispatchAutomation, recordEvent, validSameOriginRequest } from "../_shared/forms";
import { turnstileRejected, verifyTurnstile } from "../_shared/turnstile";
import { createAutomationCapability, createStatusCapability } from "../../../db/capability-tokens";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  try {
    const parsed = await readJsonObject(request, 16_384);
    if (!parsed.ok) return parsed.response;
    const input = parsed.value;
    if (!await verifyTurnstile(request, input.turnstileToken, "trial")) return turnstileRejected();
    const rate = await allowFormRequest(request, "trial", 5, 30);
    if (!rate.allowed) return Response.json({ error: "Too many trial requests were sent from this connection. Please wait and try again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
    if (clean(input.website)) return Response.json({ ok: true }, { status: 202 });
    const email = clean(input.email).toLowerCase();
    const contactName = clean(input.contactName);
    const companyName = clean(input.companyName);
    const phone = clean(input.phone, 60);
    const teamSize = clean(input.teamSize, 40);
    const product = getProduct(clean(input.productCode, 20));
    if (!EMAIL_PATTERN.test(email) || contactName.length < 2 || companyName.length < 2 || !product?.trialAvailable || clean(input.privacyAccepted) !== "yes") {
      return Response.json({ error: "Complete your name, organisation, email address, product and privacy confirmation." }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select().from(trialRequests)
      .where(and(eq(trialRequests.email, email), eq(trialRequests.productCode, product.code), eq(trialRequests.status, "requested")))
      .orderBy(desc(trialRequests.createdAt)).limit(1);
    if (existing[0]) {
      const refreshed = await createStatusCapability();
      await db.update(trialRequests).set({ accessToken: null, accessTokenHash: refreshed.tokenHash, accessTokenExpiresAt: refreshed.expiresAt, updatedAt: new Date().toISOString() }).where(eq(trialRequests.id, existing[0].id));
      return Response.json({ ok: true, existing: true, product: { code: product.code, name: product.name }, statusUrl: `/trial/status?token=${encodeURIComponent(refreshed.token)}`, message: "We already have an open trial request for this product and email address. A fresh secure status link has been issued." });
    }

    const id = crypto.randomUUID();
    const [access, automation] = await Promise.all([
      createStatusCapability(),
      createAutomationCapability("trial-automation", id),
    ]);
    await db.insert(trialRequests).values({ id, accessToken: null, accessTokenHash: access.tokenHash, accessTokenExpiresAt: access.expiresAt, automationToken: null, automationTokenHash: automation.tokenHash, automationTokenCiphertext: automation.ciphertext, automationTokenIv: automation.iv, automationTokenExpiresAt: automation.expiresAt, email, contactName, companyName, phone, productCode: product.code, teamSize, status: "requested", trialStartedAt: "", trialEndsAt: "", provisioningStatus: "queued", consentVersion: "2026-08-05", source: "website" });
    let provisioningStatus = "queued";
    try {
      const dispatched = await dispatchAutomation("trial", { automationToken: automation.token });
      provisioningStatus = dispatched.dispatched ? String(dispatched.result.status || "awaiting_credentials") : "queued";
      if (dispatched.dispatched) await db.update(trialRequests).set({ provisioningStatus, workspaceUrl: String(dispatched.result.workspaceUrl || "") || null, updatedAt: new Date().toISOString() }).where(eq(trialRequests.id, id));
    } catch {
      provisioningStatus = "dispatch_pending";
      await db.update(trialRequests).set({ provisioningStatus: "dispatch_pending", provisioningError: "Automation delivery is pending.", updatedAt: new Date().toISOString() }).where(eq(trialRequests.id, id));
    }
    await recordEvent("trial_request", { productCode: product.code, path: "/trial", outcome: provisioningStatus });
    return Response.json({ ok: true, product: { code: product.code, name: product.name }, trial: { status: "requested", startsAt: null, endsAt: null }, statusUrl: `/trial/status?token=${encodeURIComponent(access.token)}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message.includes("no such table") ? "Trial registration is being connected. Please try again shortly." : "We could not save your trial request. Please try again." }, { status: 500 });
  }
}
