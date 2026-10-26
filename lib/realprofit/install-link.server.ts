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
