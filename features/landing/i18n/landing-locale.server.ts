import { cookies, headers } from "next/headers";
import {
  detectLandingLocale,
  landingLocaleCookieName,
  type LandingLocale,
} from "./landing-locale";

export async function getLandingLocale(): Promise<LandingLocale> {
  const [store, h] = await Promise.all([cookies(), headers()]);
  return detectLandingLocale({
    cookie: store.get(landingLocaleCookieName)?.value,
    acceptLanguage: h.get("accept-language"),
    country: h.get("x-vercel-ip-country"),
  });
}
