import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Link privado del panel de un aliado: /aliado/<token>. El token lleva el id
 * del aliado firmado con HMAC (mismo secreto que Lo pagado, pero otro
 * propósito en la firma: un token de aliado no sirve como link de cliente).
 */
const PREFIX = "ap1";
const PURPOSE = "partner-panel:";
const PUBLIC_BASE = "https://www.adsholistic.com";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

function b64urlDecode(value: string): Buffer | null {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  try {
    return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
  } catch {
    return null;
  }
}

const mac = (id: string, secret: string) => createHmac("sha256", secret).update(`${PURPOSE}${id}`).digest().subarray(0, 16);

export function signPartnerPanelToken(partnerId: string, secret: string): string {
  const id = partnerId.trim().toLowerCase();
  return `${PREFIX}.${b64url(Buffer.from(id, "utf8"))}.${b64url(mac(id, secret))}`;
}

export function partnerPanelUrl(partnerId: string, secret: string): string {
  return `${PUBLIC_BASE}/aliado/${signPartnerPanelToken(partnerId, secret)}`;
}

/** Id del aliado si el token es válido; null si no. */
export function verifyPartnerPanelToken(token: string, secret: string): string | null {
  if (!secret) return null;
  const parts = String(token || "").split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const idBuf = b64urlDecode(parts[1] ?? "");
  const sigBuf = b64urlDecode(parts[2] ?? "");
  if (!idBuf || !sigBuf || sigBuf.length !== 16) return null;
  const id = idBuf.toString("utf8").trim().toLowerCase();
  if (!UUID_RE.test(id)) return null;
  const expected = mac(id, secret);
  return timingSafeEqual(expected, sigBuf) ? id : null;
}
