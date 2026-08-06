import { eq, or } from "drizzle-orm";
import { getDb } from "./index";
import { contactRequests } from "./schema";
import { capabilityExpired, capabilityExpiry, hashCapabilityToken } from "./capability-tokens";

export async function findContactByAutomationToken(token: string) {
  const tokenHash = await hashCapabilityToken(token);
  const db = getDb();
  const rows = await db.select().from(contactRequests)
    .where(or(eq(contactRequests.automationTokenHash, tokenHash), eq(contactRequests.automationToken, token)))
    .limit(1);
  const enquiry = rows[0];
  if (!enquiry || capabilityExpired(enquiry.automationTokenExpiresAt)) return null;
  if (!enquiry.automationTokenHash || enquiry.automationToken) {
    const expiresAt = enquiry.automationTokenExpiresAt || capabilityExpiry(24 * 7);
    await db.update(contactRequests).set({ automationToken: null, automationTokenHash: tokenHash, automationTokenExpiresAt: expiresAt, updatedAt: new Date().toISOString() })
      .where(eq(contactRequests.id, enquiry.id));
    return { ...enquiry, automationToken: null, automationTokenHash: tokenHash, automationTokenExpiresAt: expiresAt };
  }
  return enquiry;
}
