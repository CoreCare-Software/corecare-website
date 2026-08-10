import { eq, or } from "drizzle-orm";
import { getDb } from "./index";
import { trialRequests } from "./schema";
import {
  capabilityExpired,
  capabilityExpiry,
  decryptCapabilityToken,
  encryptCapabilityToken,
  hashCapabilityToken,
} from "./capability-tokens";

export type TrialRequest = typeof trialRequests.$inferSelect;

export async function findTrialByStatusToken(token: string) {
  const tokenHash = await hashCapabilityToken(token);
  const db = getDb();
  const rows = await db.select().from(trialRequests)
    .where(or(eq(trialRequests.accessTokenHash, tokenHash), eq(trialRequests.accessToken, token)))
    .limit(1);
  const trial = rows[0];
  if (!trial || capabilityExpired(trial.accessTokenExpiresAt)) return null;
  if (!trial.accessTokenHash || trial.accessToken) {
    const expiresAt = trial.accessTokenExpiresAt || capabilityExpiry(24 * 120);
    await db.update(trialRequests).set({ accessTokenHash: tokenHash, accessToken: null, accessTokenExpiresAt: expiresAt, updatedAt: new Date().toISOString() })
      .where(eq(trialRequests.id, trial.id));
    return { ...trial, accessToken: null, accessTokenHash: tokenHash, accessTokenExpiresAt: expiresAt };
  }
  return trial;
}

export async function automationTokenForTrial(trial: TrialRequest) {
  if (capabilityExpired(trial.automationTokenExpiresAt)) return "";
  if (trial.automationTokenCiphertext && trial.automationTokenIv) {
    try {
      return await decryptCapabilityToken(trial.automationTokenCiphertext, trial.automationTokenIv, "trial-automation", trial.id);
    } catch {
      return "";
    }
  }
  if (!trial.automationToken) return "";
  const [tokenHash, encrypted] = await Promise.all([
    hashCapabilityToken(trial.automationToken),
    encryptCapabilityToken(trial.automationToken, "trial-automation", trial.id),
  ]);
  const expiresAt = trial.automationTokenExpiresAt || capabilityExpiry(24 * 120);
  await getDb().update(trialRequests).set({
    automationToken: null,
    automationTokenHash: tokenHash,
    automationTokenCiphertext: encrypted.ciphertext,
    automationTokenIv: encrypted.iv,
    automationTokenExpiresAt: expiresAt,
    updatedAt: new Date().toISOString(),
  }).where(eq(trialRequests.id, trial.id));
  return trial.automationToken;
}

export async function findTrialByAutomationToken(token: string) {
  const tokenHash = await hashCapabilityToken(token);
  const db = getDb();
  const rows = await db.select().from(trialRequests)
    .where(or(eq(trialRequests.automationTokenHash, tokenHash), eq(trialRequests.automationToken, token)))
    .limit(1);
  const trial = rows[0];
  if (!trial || capabilityExpired(trial.automationTokenExpiresAt)) return null;
  if (!trial.automationTokenHash || !trial.automationTokenCiphertext || !trial.automationTokenIv || trial.automationToken) {
    const encrypted = await encryptCapabilityToken(token, "trial-automation", trial.id);
    const expiresAt = trial.automationTokenExpiresAt || capabilityExpiry(24 * 120);
    await db.update(trialRequests).set({
      automationToken: null,
      automationTokenHash: tokenHash,
      automationTokenCiphertext: encrypted.ciphertext,
      automationTokenIv: encrypted.iv,
      automationTokenExpiresAt: expiresAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(trialRequests.id, trial.id));
    return { ...trial, automationToken: null, automationTokenHash: tokenHash, automationTokenCiphertext: encrypted.ciphertext, automationTokenIv: encrypted.iv, automationTokenExpiresAt: expiresAt };
  }
  return trial;
}
