import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env/env.server";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKeyMaterial(): Buffer {
  const raw = serverEnv.encryptionKey;
  if (!raw) {
    if (serverEnv.isProduction) {
      throw new Error("ENCRYPTION_KEY es obligatorio para cifrar credenciales en producción.");
    }
    return createHash("sha256").update("development-only-insecure-key").digest();
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall back to hashing below.
  }

  return createHash("sha256").update(raw).digest();
}

export interface EncryptedPayload {
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encryptText(plainText: string): EncryptedPayload {
  const key = getKeyMaterial();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    alg: ALGORITHM,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptText(payload: EncryptedPayload): string {
  if (payload.alg !== ALGORITHM) {
    throw new Error(`Algoritmo de cifrado no soportado: ${payload.alg}`);
  }

  const key = getKeyMaterial();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(payload.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function encryptJson(value: Record<string, unknown>): EncryptedPayload {
  return encryptText(JSON.stringify(value));
}

export function decryptJson<T extends Record<string, unknown>>(payload: EncryptedPayload): T {
  return JSON.parse(decryptText(payload)) as T;
}

function getSigningSecret(): string {
  return serverEnv.internalJobSecret || serverEnv.encryptionKey || "development-only-insecure-secret";
}

export function signValue(value: string): string {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

export function verifySignedValue(value: string, signature: string): boolean {
  const expected = signValue(value);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
