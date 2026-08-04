import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { trialRequests } from "../../../../db/schema";
import { getProduct } from "../../../products";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { token?: string };
    const token = String(input.token || "").trim().slice(0, 160);
    if (token.length < 40) return Response.json({ error: "Trial not found." }, { status: 404 });
    const db = getDb();
    const rows = await db.select({ companyName: trialRequests.companyName, productCode: trialRequests.productCode, status: trialRequests.status, trialStartedAt: trialRequests.trialStartedAt, trialEndsAt: trialRequests.trialEndsAt }).from(trialRequests).where(eq(trialRequests.accessToken, token)).limit(1);
    const row = rows[0];
    if (!row) return Response.json({ error: "Trial not found." }, { status: 404 });
    const expired = new Date(row.trialEndsAt).getTime() <= Date.now();
    const product = getProduct(row.productCode);
    return Response.json({ trial: { companyName: row.companyName, status: expired && row.status === "active" ? "expired" : row.status, startsAt: row.trialStartedAt, endsAt: row.trialEndsAt }, product: product ? { code: product.code, name: product.name, liveUrl: product.liveUrl } : null });
  } catch {
    return Response.json({ error: "We could not load this trial." }, { status: 500 });
  }
}
