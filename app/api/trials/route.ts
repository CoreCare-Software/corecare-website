import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { trialRequests } from "../../../db/schema";
import { getProduct } from "../../products";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string, unknown>;
    if (clean(input.website)) return Response.json({ ok: true }, { status: 202 });
    const email = clean(input.email).toLowerCase();
    const contactName = clean(input.contactName);
    const companyName = clean(input.companyName);
    const phone = clean(input.phone, 60);
    const teamSize = clean(input.teamSize, 40);
    const product = getProduct(clean(input.productCode, 20));
    if (!EMAIL_PATTERN.test(email) || contactName.length < 2 || companyName.length < 2 || !product?.trialAvailable) {
      return Response.json({ error: "Please complete your name, organisation, email and product." }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select().from(trialRequests)
      .where(and(eq(trialRequests.email, email), eq(trialRequests.productCode, product.code), eq(trialRequests.status, "requested")))
      .orderBy(desc(trialRequests.createdAt)).limit(1);
    if (existing[0]) {
      return Response.json({ ok: true, existing: true, product: { code: product.code, name: product.name }, message: "We already have an open trial request for this product and email address." });
    }

    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const id = crypto.randomUUID();
    const accessToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll("-", "")}`;
    await db.insert(trialRequests).values({ id, accessToken, email, contactName, companyName, phone, productCode: product.code, teamSize, status: "requested", trialStartedAt: now.toISOString(), trialEndsAt: end.toISOString() });
    return Response.json({ ok: true, product: { code: product.code, name: product.name }, trial: { status: "requested", startsAt: now.toISOString(), endsAt: end.toISOString() }, statusUrl: `/trial/status?token=${encodeURIComponent(accessToken)}` }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message.includes("no such table") ? "Trial registration is being connected. Please try again shortly." : "We could not save your trial request. Please try again." }, { status: 500 });
  }
}
