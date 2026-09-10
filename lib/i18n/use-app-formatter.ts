"use client";

import { useFormatter, useLocale } from "next-intl";
import { toBcp47Locale } from "@/i18n/config";

/** Client-side money/number/date formatters bound to the active UI locale. */
export function useAppFormatter() {
  const locale = useLocale();
  const formatter = useFormatter();
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
