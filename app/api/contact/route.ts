import { getDb } from "../../../db";
import { contactRequests } from "../../../db/schema";
import { getProduct } from "../../products";
import { readJsonObject } from "../_shared/body";
import { allowFormRequest, dispatchAutomation, recordEvent, validSameOriginRequest } from "../_shared/forms";
import { turnstileRejected, verifyTurnstile } from "../_shared/turnstile";
import { createStatusCapability } from "../../../db/capability-tokens";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  try {
    const parsed = await readJsonObject(request, 16_384);
    if (!parsed.ok) return parsed.response;
    const input = parsed.value;
    if (!await verifyTurnstile(request, input.turnstileToken, "contact")) return turnstileRejected();
    const rate = await allowFormRequest(request, "contact", 5, 15);
    if (!rate.allowed) return Response.json({ error: "Too many enquiries were sent from this connection. Please wait and try again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
    if (clean(input.website)) return Response.json({ ok: true }, { status: 202 });
    const email = clean(input.email).toLowerCase();
    const contactName = clean(input.contactName);
    const companyName = clean(input.companyName);
    const message = clean(input.message, 5_000);
    const product = getProduct(clean(input.productCode, 20));
    if (!EMAIL_PATTERN.test(email) || contactName.length < 2 || companyName.length < 2 || message.length < 10 || clean(input.privacyAccepted) !== "yes") {
      return Response.json({ error: "Complete your name, organisation, email address, message and privacy confirmation." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const automation = await createStatusCapability(24 * 7);
    const reference = `CC-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;
    await getDb().insert(contactRequests).values({ id, reference, automationToken: null, automationTokenHash: automation.tokenHash, automationTokenExpiresAt: automation.expiresAt, email, contactName, companyName, productCode: product?.code || null, message, status: "new", consentVersion: "2026-08-05" });
    let outcome = "saved";
    try { const dispatched = await dispatchAutomation("contact", { automationToken: automation.token }); outcome = dispatched.dispatched ? "dispatched" : "saved"; } catch { outcome = "dispatch_pending"; }
    await recordEvent("contact_request", { productCode: product?.code, path: "/contact", outcome });
    return Response.json({ ok: true, reference }, { status: 201 });
  } catch {
    return Response.json({ error: "We could not save your enquiry. Please try again." }, { status: 500 });
  }
}
