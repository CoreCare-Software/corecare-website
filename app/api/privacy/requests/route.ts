import { getDb } from "../../../../db";
import { privacyRequests } from "../../../../db/schema";
import { getProduct } from "../../../products";
import { readJsonObject } from "../../_shared/body";
import { allowFormRequest, recordEvent, validSameOriginRequest } from "../../_shared/forms";
import { turnstileRejected, verifyTurnstile } from "../../_shared/turnstile";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUEST_TYPES = new Set(["access", "correction", "erasure", "restriction", "objection", "portability", "other"]);
const RELATIONSHIPS = new Set(["website_visitor", "customer_user", "trial_user", "employee_or_applicant", "other"]);
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

function oneCalendarMonthFrom(date: Date) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function POST(request: Request) {
  if (!validSameOriginRequest(request)) return Response.json({ error: "This request could not be verified." }, { status: 403 });
  try {
    const parsed = await readJsonObject(request, 24_576);
    if (!parsed.ok) return parsed.response;
    const input = parsed.value;
    if (!await verifyTurnstile(request, input.turnstileToken, "data_rights")) return turnstileRejected();
    const rate = await allowFormRequest(request, "privacy-rights", 4, 30);
    if (!rate.allowed) return Response.json({ error: "Too many requests were sent from this connection. Please wait and try again." }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
    if (clean(input.website)) return Response.json({ ok: true }, { status: 202 });

    const requesterName = clean(input.requesterName);
    const requesterEmail = clean(input.requesterEmail).toLowerCase();
    const organisationName = clean(input.organisationName);
    const requestType = clean(input.requestType, 40).toLowerCase();
    const relationship = clean(input.relationship, 40).toLowerCase();
    const requestSummary = clean(input.requestSummary, 2_000);
    const product = getProduct(clean(input.productCode, 20));

    if (requesterName.length < 2 || !EMAIL_PATTERN.test(requesterEmail) || !REQUEST_TYPES.has(requestType) || !RELATIONSHIPS.has(relationship) || requestSummary.length < 10 || clean(input.privacyAccepted) !== "yes") {
      return Response.json({ error: "Complete your name, email, relationship, request type, request details and privacy confirmation." }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const automationToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
    const received = new Date();
    const reference = `DSR-${received.toISOString().slice(2, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;
    const dueAt = oneCalendarMonthFrom(received);
    await getDb().insert(privacyRequests).values({
      id,
      reference,
      automationToken,
      requestType,
      requesterName,
      requesterEmail,
      organisationName,
      relationship,
      productCode: product?.code || null,
      requestSummary,
      status: "received",
      identityStatus: "not_checked",
      receivedAt: received.toISOString(),
      dueAt: dueAt.toISOString(),
      consentVersion: "2026-08-05",
    });
    await recordEvent("privacy_request", { productCode: product?.code, path: "/data-rights", outcome: requestType });
    return Response.json({ ok: true, reference, receivedAt: received.toISOString(), dueAt: dueAt.toISOString() }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "We could not save your request. Please try again or email privacy@corecaresystems.co.uk." }, { status: 500 });
  }
}
