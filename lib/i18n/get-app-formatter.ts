import { getFormatter, getLocale } from "next-intl/server";
import { toBcp47Locale } from "@/i18n/config";

/** Server-side formatters bound to the active UI locale. */
export async function getAppFormatter() {
  const locale = await getLocale();
  const formatter = await getFormatter();
  const bcp47 = toBcp47Locale(locale);

  return {
    locale,
    bcp47,
    formatMoney: (amount: number, currency = "USD") =>
      formatter.number(amount, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    formatNumber: (value: number) => formatter.number(value),
    formatDate: (value: Date | number | string) =>
      formatter.dateTime(
        value instanceof Date || typeof value === "number"
          ? value
          : new Date(value),
        { dateStyle: "medium" },
      ),
    formatDateTime: (value: Date | number | string) =>
      formatter.dateTime(
        value instanceof Date || typeof value === "number"
          ? value
          : new Date(value),
        { dateStyle: "medium", timeStyle: "short" },
      ),
  };
}
