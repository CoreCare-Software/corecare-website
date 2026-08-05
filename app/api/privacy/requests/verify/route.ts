import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { privacyRequests } from "../../../../../db/schema";
import { readJsonObject } from "../../../_shared/body";

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const parsed = await readJsonObject(request, 16_384);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  const automationToken = clean(input.automationToken, 160);
  if (automationToken.length < 40) return Response.json({ error: "Request authorisation not found." }, { status: 404 });
  const rows = await getDb().select({
    id: privacyRequests.id,
    reference: privacyRequests.reference,
    requestType: privacyRequests.requestType,
    requesterName: privacyRequests.requesterName,
    requesterEmail: privacyRequests.requesterEmail,
    organisationName: privacyRequests.organisationName,
    relationship: privacyRequests.relationship,
    productCode: privacyRequests.productCode,
    requestSummary: privacyRequests.requestSummary,
    status: privacyRequests.status,
    receivedAt: privacyRequests.receivedAt,
    dueAt: privacyRequests.dueAt,
  }).from(privacyRequests).where(eq(privacyRequests.automationToken, automationToken)).limit(1);
  if (!rows[0]) return Response.json({ error: "Request authorisation not found." }, { status: 404 });
  return Response.json({ ok: true, privacyRequest: rows[0] }, { headers: { "cache-control": "no-store" } });
}
