import "server-only";
import { createHmac } from "node:crypto";

/** Vence en 1 día: el cliente puede abrir el link, instalar y volver. */
const LINK_TTL_SECONDS = 24 * 60 * 60;

export function realProfitBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() ||
    "https://www.realprofitcod.com"
  ).replace(/\/$/, "");
}

/**
 * Link de instalación Shopify de Real Profit firmado con el cliente Hecom.
 * Al terminar el OAuth (prueba de que es admin de la tienda), Real Profit vincula
 * la tienda a este cliente. Verificación: realprofitcod `src/lib/shopify/holistic-link.ts`.
 * Sin HOLISTIC_LINK_SECRET el link instala igual, pero no vincula solo.
 */
export function buildRealProfitInstallUrl(hecomClienteId: string): string {
  const url = new URL("/api/shopify/auth", realProfitBaseUrl());
  url.searchParams.set("surface", "web");
  const secret = process.env.HOLISTIC_LINK_SECRET?.trim();
  if (secret) {
    const payload = Buffer.from(
      JSON.stringify({
        c: hecomClienteId,
        exp: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
      }),
    ).toString("base64url");
    const sig = createHmac("sha256", secret).update(payload).digest("base64url");
    url.searchParams.set("holistic", `${payload}.${sig}`);
  }
  return url.toString();
}

/** Token corto para llamar a la API de Real Profit en nombre del cliente (p:'api'). */
function signApiToken(hecomClienteId: string): string | null {
  const secret = process.env.HOLISTIC_LINK_SECRET?.trim();
  if (!secret) return null;
  const payload = Buffer.from(
    JSON.stringify({
      c: hecomClienteId,
      p: "api",
      exp: Math.floor(Date.now() / 1000) + 120,
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * POST a Real Profit firmado con el cliente. Sin `www.`: el redirect al dominio
 * raíz es cross-origin y fetch descarta el header Authorization.
 */
export async function callRealProfitApi<T>(
  path: string,
  hecomClienteId: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const token = signApiToken(hecomClienteId);
  if (!token) {
    return {
      ok: false,
      status: 503,
      data: { error: "Falta HOLISTIC_LINK_SECRET en el servidor." } as T & { error?: string },
    };
  }
  const base = realProfitBaseUrl().replace("://www.", "://");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  return { ok: res.ok, status: res.status, data };
}
