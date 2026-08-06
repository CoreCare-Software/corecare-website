import { findContactByAutomationToken } from "../../../../db/contact-capabilities";
import { readJsonObject } from "../../_shared/body";

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const parsed = await readJsonObject(request, 16_384);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  const automationToken = clean(input.automationToken, 160);
  if (automationToken.length < 40) return Response.json({ error: "Enquiry authorisation not found." }, { status: 404 });
  const row = await findContactByAutomationToken(automationToken);
  if (!row) return Response.json({ error: "Enquiry authorisation not found." }, { status: 404 });
  const { id, reference, email, contactName, companyName, productCode, message, status, createdAt } = row;
  return Response.json({ ok: true, enquiry: { id, reference, email, contactName, companyName, productCode, message, status, createdAt } }, { headers: { "cache-control": "no-store" } });
}
