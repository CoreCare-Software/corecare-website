import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { contactRequests } from "../../../../db/schema";
import { readJsonObject } from "../../_shared/body";

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const parsed = await readJsonObject(request, 16_384);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  const automationToken = clean(input.automationToken, 160);
  if (automationToken.length < 40) return Response.json({ error: "Enquiry authorisation not found." }, { status: 404 });
  const rows = await getDb().select({
    id: contactRequests.id,
    reference: contactRequests.reference,
    email: contactRequests.email,
    contactName: contactRequests.contactName,
    companyName: contactRequests.companyName,
    productCode: contactRequests.productCode,
    message: contactRequests.message,
    status: contactRequests.status,
    createdAt: contactRequests.createdAt,
  }).from(contactRequests).where(eq(contactRequests.automationToken, automationToken)).limit(1);
  if (!rows[0]) return Response.json({ error: "Enquiry authorisation not found." }, { status: 404 });
  return Response.json({ ok: true, enquiry: rows[0] }, { headers: { "cache-control": "no-store" } });
}
