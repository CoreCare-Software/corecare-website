import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { trialRequests } from "../../../db/schema";
import { getProduct } from "../../products";
import { allowFormRequest, dispatchAutomation, recordEvent, validSameOriginRequest } from "../_shared/forms";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  try {
    const rate = await allowFormRequest(request, "trial", 5, 30);
    if (!rate.allowed) return Response.json({ error: "Too many trial requests were sent from this connection. Please wait and try again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
    const input = await request.json() as Record<string, unknown>;
    if (clean(input.website)) return Response.json({ ok: true }, { status: 202 });
    const email = clean(input.email).toLowerCase();
    const contactName = clean(input.contactName);
    const companyName = clean(input.companyName);
    const phone = clean(input.phone, 60);
    const teamSize = clean(input.teamSize, 40);
    const product = getProduct(clean(input.productCode, 20));
    if (!EMAIL_PATTERN.test(email) || contactName.length < 2 || companyName.length < 2 || !product?.trialAvailable || clean(input.privacyAccepted) !== "yes") {
      return Response.json({ error: "Complete your name, organisation, work email, product and privacy confirmation." }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select().from(trialRequests)
      .where(and(eq(trialRequests.email, email), eq(trialRequests.productCode, product.code), eq(trialRequests.status, "requested")))
      .orderBy(desc(trialRequests.createdAt)).limit(1);
    if (existing[0]) {
      return Response.json({ ok: true, existing: true, product: { code: product.code, name: product.name }, statusUrl: `/trial/status?token=${encodeURIComponent(existing[0].accessToken)}`, message: "We already have an open trial request for this product and email address." });
    }

    const id = crypto.randomUUID();
    const accessToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
    await db.insert(trialRequests).values({ id, accessToken, email, contactName, companyName, phone, productCode: product.code, teamSize, status: "requested", trialStartedAt: "", trialEndsAt: "", provisioningStatus: "queued", consentVersion: "2026-08-04", source: "website" });
    let provisioningStatus = "queued";
    try {
      const dispatched = await dispatchAutomation("trial", { id, email, contactName, companyName, phone, teamSize, productCode: product.code, statusCallbackToken: accessToken });
      provisioningStatus = dispatched.dispatched ? "dispatched" : "queued";
      if (dispatched.dispatched) await db.update(trialRequests).set({ provisioningStatus: "dispatched", updatedAt: new Date().toISOString() }).where(eq(trialRequests.id, id));
    } catch {
      provisioningStatus = "dispatch_pending";
      await db.update(trialRequests).set({ provisioningStatus: "dispatch_pending", provisioningError: "Automation delivery is pending.", updatedAt: new Date().toISOString() }).where(eq(trialRequests.id, id));
    }
    await recordEvent("trial_request", { productCode: product.code, path: "/trial", outcome: provisioningStatus });
    return Response.json({ ok: true, product: { code: product.code, name: product.name }, trial: { status: "requested", startsAt: null, endsAt: null }, statusUrl: `/trial/status?token=${encodeURIComponent(accessToken)}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message.includes("no such table") ? "Trial registration is being connected. Please try again shortly." : "We could not save your trial request. Please try again." }, { status: 500 });
  }
}
