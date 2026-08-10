import { env } from "cloudflare:workers";

const TOKEN_BYTES = 32;
const MINIMUM_SECRET_LENGTH = 32;

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalised = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export async function hashCapabilityToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

function encryptionSecret() {
  const runtime = env as unknown as Record<string, unknown>;
  const secret = String(runtime.WEBSITE_TOKEN_ENCRYPTION_KEY || "");
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error("Website capability-token encryption is not configured.");
  }
  return secret;
}

async function encryptionKey() {
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encryptionSecret()));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function additionalData(purpose: string, recordId: string) {
  return new TextEncoder().encode(`corecare-website|${purpose}|${recordId}`);
}

export async function encryptCapabilityToken(value: string, purpose: string, recordId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: additionalData(purpose, recordId) },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return { ciphertext: base64Url(new Uint8Array(ciphertext)), iv: base64Url(iv) };
}

export async function decryptCapabilityToken(ciphertext: string, iv: string, purpose: string, recordId: string) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv), additionalData: additionalData(purpose, recordId) },
    await encryptionKey(),
    fromBase64Url(ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

export function capabilityExpiry(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1_000).toISOString();
}

export async function createStatusCapability(hours = 24 * 120) {
  const token = randomToken();
  return { token, tokenHash: await hashCapabilityToken(token), expiresAt: capabilityExpiry(hours) };
}

export async function createAutomationCapability(purpose: string, recordId: string, hours = 24 * 120) {
  const token = randomToken();
  const [{ ciphertext, iv }, tokenHash] = await Promise.all([
    encryptCapabilityToken(token, purpose, recordId),
    hashCapabilityToken(token),
  ]);
  return { token, tokenHash, ciphertext, iv, expiresAt: capabilityExpiry(hours) };
}

export function capabilityExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return !Number.isFinite(time) || time <= Date.now();
}
