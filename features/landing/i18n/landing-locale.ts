/**
 * Idioma de la landing pública (independiente del `NEXT_LOCALE` del sistema).
 * Solo afecta a `/`; el dashboard sigue con su propio i18n.
 */
export const landingLocales = ["es", "en", "pt", "zh"] as const;

export type LandingLocale = (typeof landingLocales)[number];

export const defaultLandingLocale: LandingLocale = "es";

/** Cookie con la elección manual del visitante. */
export const landingLocaleCookieName = "HOLISTIC_LANDING_LANG";

export const landingLocaleLabels: Record<LandingLocale, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
  zh: "中文",
};

export const landingLocaleShort: Record<LandingLocale, string> = {
  es: "ES",
  en: "EN",
  pt: "PT",
  zh: "中文",
};

/** Valor para el atributo `lang` del HTML. */
export const landingLocaleHtmlLang: Record<LandingLocale, string> = {
  es: "es",
  en: "en",
  pt: "pt-BR",
  zh: "zh-CN",
};

export function isLandingLocale(value: unknown): value is LandingLocale {
  return typeof value === "string" && (landingLocales as readonly string[]).includes(value);
}

function matchLanguageTag(tag: string): LandingLocale | null {
  const t = tag.trim().toLowerCase();
  if (t.startsWith("zh")) return "zh";
  if (t.startsWith("pt")) return "pt";
  if (t.startsWith("en")) return "en";
  if (t.startsWith("es")) return "es";
  return null;
}

/** Primer idioma soportado según el orden de preferencia del navegador. */
function fromAcceptLanguage(header: string | null | undefined): LandingLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const quality = q ? Number.parseFloat(q.slice(2)) : 1;
      return { tag: tag ?? "", quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const entry of ranked) {
    const match = matchLanguageTag(entry.tag);
    if (match) return match;
  }
  return null;
}

const CHINESE_COUNTRIES = new Set(["CN", "TW", "HK", "MO", "SG"]);
const PORTUGUESE_COUNTRIES = new Set(["BR", "PT", "AO", "MZ", "CV", "GW", "ST", "TL"]);
const SPANISH_COUNTRIES = new Set([
  "PE", "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GQ", "GT",
  "HN", "MX", "NI", "PA", "PR", "PY", "SV", "UY", "VE",
]);

/** Respaldo por país (header `x-vercel-ip-country`). */
function fromCountry(country: string | null | undefined): LandingLocale | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  if (!code) return null;
  if (CHINESE_COUNTRIES.has(code)) return "zh";
  if (PORTUGUESE_COUNTRIES.has(code)) return "pt";
  if (SPANISH_COUNTRIES.has(code)) return "es";
  return "en";
}

/** Parámetro de URL que fija el idioma (`/?lang=en`), usado para hreflang. */
export const landingLocaleQueryParam = "lang";

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|linkedin|preview|lighthouse|headless/i;

/**
 * Orden: `?lang=` → elección manual (cookie) → idioma del navegador → país → español.
 * Robots y visitas sin `Accept-Language` reciben español: Googlebot rastrea desde
 * EE. UU. sin idioma y, si no, indexaría la versión en inglés.
 */
export function detectLandingLocale(input: {
  query?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
  userAgent?: string | null;
}): LandingLocale {
  if (isLandingLocale(input.query)) return input.query;
  if (isLandingLocale(input.cookie)) return input.cookie;
  if (input.userAgent && BOT_UA.test(input.userAgent)) return defaultLandingLocale;
  if (!input.acceptLanguage?.trim()) return defaultLandingLocale;
  return (
    fromAcceptLanguage(input.acceptLanguage) ??
    fromCountry(input.country) ??
    defaultLandingLocale
  );
}
