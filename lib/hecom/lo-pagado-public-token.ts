import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "lp1";

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function b64urlDecode(value: string): Buffer | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  try {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
  } catch {
    return null;
  }
}

/**
 * Enlace estable de Lo pagado. Misma fórmula en Hecom
 * (`pendientes-marketing-send.js` → loPagadoPublicUrl) con el secret
 * compartido HOLISTIC_WA_SNAPSHOT_SECRET / ADS_HOLISTIC_WA_SNAPSHOT_SECRET.
 * Rotar ese secret invalida los links ya enviados.
 */
export function signLoPagadoToken(clientId: string, secret: string): string {
  const id = clientId.trim().toLowerCase();
  const mac = createHmac("sha256", secret)
    .update(`lo-pagado:${id}`)
    .digest()
    .subarray(0, 16);
  return `${PREFIX}.${b64url(Buffer.from(id, "utf8"))}.${b64url(mac)}`;
}

export function verifyLoPagadoToken(token: string, secret: string): string | null {
  if (!secret) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const idBuf = b64urlDecode(parts[1] || "");
  const sigBuf = b64urlDecode(parts[2] || "");
  if (!idBuf || !sigBuf || sigBuf.length !== 16) return null;
  const id = idBuf.toString("utf8").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    return null;
  }
  const expected = createHmac("sha256", secret)
    .update(`lo-pagado:${id}`)
    .digest()
    .subarray(0, 16);
  if (expected.length !== sigBuf.length || !timingSafeEqual(expected, sigBuf)) {
    return null;
  }
  return id;
}
