import { defaultLocale, toBcp47Locale } from "@/i18n/config";

export function formatMoney(
  amount: number,
  currency = "USD",
  locale: string = toBcp47Locale(defaultLocale),
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
