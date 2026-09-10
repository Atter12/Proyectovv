import { defaultLocale, toBcp47Locale } from "@/i18n/config";

export function formatNumber(
  value: number,
  locale: string = toBcp47Locale(defaultLocale),
): string {
  return new Intl.NumberFormat(locale).format(value);
}
