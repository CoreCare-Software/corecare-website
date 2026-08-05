import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trialRequests } from "../../../../db/schema";
import { readJsonObject } from "../../_shared/body";

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const parsed = await readJsonObject(request, 16_384);
  if (!parsed.ok) return parsed.response;
  const input = parsed.value;
  const automationToken = clean(input.automationToken, 160);
  if (automationToken.length < 40) return Response.json({ error: "Trial authorisation not found." }, { status: 404 });
  const rows = await getDb().select({
    id: trialRequests.id,
    email: trialRequests.email,
    contactName: trialRequests.contactName,
    companyName: trialRequests.companyName,
    phone: trialRequests.phone,
    teamSize: trialRequests.teamSize,
    productCode: trialRequests.productCode,
    status: trialRequests.status,
    createdAt: trialRequests.createdAt,
  }).from(trialRequests).where(eq(trialRequests.automationToken, automationToken)).limit(1);
  const trial = rows[0];
  if (!trial || !["requested", "active", "expired", "converted"].includes(trial.status)) return Response.json({ error: "Trial authorisation not found." }, { status: 404 });
  return Response.json({ ok: true, trial }, { headers: { "cache-control": "no-store" } });
}
