import { cookies, headers } from "next/headers";
import {
  detectLandingLocale,
  landingLocaleCookieName,
  type LandingLocale,
} from "./landing-locale";

/** `query` = valor de `?lang=` cuando la página lo recibe (solo la landing). */
export async function getLandingLocale(query?: string | string[] | null): Promise<LandingLocale> {
  const [store, h] = await Promise.all([cookies(), headers()]);
  return detectLandingLocale({
    query: Array.isArray(query) ? query[0] : query,
    cookie: store.get(landingLocaleCookieName)?.value,
    acceptLanguage: h.get("accept-language"),
    country: h.get("x-vercel-ip-country"),
    userAgent: h.get("user-agent"),
  });
}
