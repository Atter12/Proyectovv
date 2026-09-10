export const locales = ["es", "en", "pt-BR"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "es";

/** Cookie that persists the user's UI language preference. */
export const localeCookieName = "NEXT_LOCALE";

export const localeLabels: Record<AppLocale, string> = {
  es: "Español",
  en: "English",
  "pt-BR": "Português (Brasil)",
};

/** BCP 47 tags for `Intl` (dates/numbers). */
export function toBcp47Locale(locale: string): string {
  switch (locale) {
    case "en":
      return "en-US";
    case "pt-BR":
      return "pt-BR";
    case "es":
    default:
      return "es-PE";
  }
}

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

export function resolveAppLocale(value: string | undefined | null): AppLocale {
  if (value && isAppLocale(value)) return value;
  return defaultLocale;
}
