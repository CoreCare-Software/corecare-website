import { findTrialByAutomationToken } from "../../../../db/trial-capabilities";
import { readJsonObject } from "../../_shared/body";

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const parsed = await readJsonObject(request, 16_384);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  const automationToken = clean(input.automationToken, 160);
  if (automationToken.length < 40) return Response.json({ error: "Trial authorisation not found." }, { status: 404 });
  const row = await findTrialByAutomationToken(automationToken);
  const trial = row ? { id: row.id, email: row.email, contactName: row.contactName, companyName: row.companyName, phone: row.phone, teamSize: row.teamSize, productCode: row.productCode, status: row.status, createdAt: row.createdAt } : null;
  if (!trial || !["requested", "active", "expired", "converted"].includes(trial.status)) return Response.json({ error: "Trial authorisation not found." }, { status: 404 });
  return Response.json({ ok: true, trial }, { headers: { "cache-control": "no-store" } });
}
