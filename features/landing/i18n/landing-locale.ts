/**
 * Idioma de la landing pública (independiente del `NEXT_LOCALE` del sistema).
 * Solo afecta a `/`; el dashboard sigue con su propio i18n.
 */
export const landingLocales = ["es", "en", "zh"] as const;

export type LandingLocale = (typeof landingLocales)[number];

export const defaultLandingLocale: LandingLocale = "es";

/** Cookie con la elección manual del visitante. */
export const landingLocaleCookieName = "HOLISTIC_LANDING_LANG";

export const landingLocaleLabels: Record<LandingLocale, string> = {
  es: "Español",
  en: "English",
  zh: "中文",
};

export const landingLocaleShort: Record<LandingLocale, string> = {
  es: "ES",
  en: "EN",
  zh: "中文",
};

/** Valor para el atributo `lang` del HTML. */
export const landingLocaleHtmlLang: Record<LandingLocale, string> = {
  es: "es",
  en: "en",
  zh: "zh-CN",
};

export function isLandingLocale(value: unknown): value is LandingLocale {
  return typeof value === "string" && (landingLocales as readonly string[]).includes(value);
}

function matchLanguageTag(tag: string): LandingLocale | null {
  const t = tag.trim().toLowerCase();
  if (t.startsWith("zh")) return "zh";
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
const SPANISH_COUNTRIES = new Set([
  "PE", "AR", "BO", "CL", "CO", "CR", "CU", "DO", "EC", "ES", "GQ", "GT",
  "HN", "MX", "NI", "PA", "PR", "PY", "SV", "UY", "VE", "BR",
]);

/** Respaldo por país (header `x-vercel-ip-country`). */
function fromCountry(country: string | null | undefined): LandingLocale | null {
  if (!country) return null;
  const code = country.trim().toUpperCase();
  if (!code) return null;
  if (CHINESE_COUNTRIES.has(code)) return "zh";
  if (SPANISH_COUNTRIES.has(code)) return "es";
  return "en";
}

/**
 * Orden: elección manual (cookie) → idioma del navegador → país → español.
 */
export function detectLandingLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
}): LandingLocale {
  if (isLandingLocale(input.cookie)) return input.cookie;
  return (
    fromAcceptLanguage(input.acceptLanguage) ??
    fromCountry(input.country) ??
    defaultLandingLocale
  );
}
