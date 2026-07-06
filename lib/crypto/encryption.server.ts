import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env/env.server";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const FORMAT_PREFIX = "v1";

function getEncryptionKey(): Buffer {
  const configured = serverEnv.encryptionKey;

  if (!configured) {
    if (serverEnv.isProduction) {
      throw new Error("[encryption] ENCRYPTION_KEY es obligatorio en producción.");
    }
    return createHash("sha256")
      .update("development-only-proyectovv-encryption-key")
      .digest();
  }

  const trimmed = configured.trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  try {
    const base64 = Buffer.from(trimmed, "base64");
    if (base64.length === 32) return base64;
  } catch {
    // Fallback to SHA-256 below.
  }

  return createHash("sha256").update(trimmed).digest();
}

export function encryptText(plainText: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    FORMAT_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptText(cipherText: string): string {
  const [version, ivEncoded, tagEncoded, payloadEncoded] = cipherText.split(":");
  if (version !== FORMAT_PREFIX || !ivEncoded || !tagEncoded || !payloadEncoded) {
    throw new Error("[encryption] Formato cifrado inválido.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(tagEncoded, "base64url");
  const payload = Buffer.from(payloadEncoded, "base64url");

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encryptText(JSON.stringify(value));
}

export function decryptJson<T>(cipherText: string): T {
  return JSON.parse(decryptText(cipherText)) as T;
}
