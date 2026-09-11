"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format-money";
import type { summarizePaymentAccounts } from "@/lib/sort/payment-accounts";

type Summary = ReturnType<typeof summarizePaymentAccounts>;

interface PaymentsGerenteAccountsSummaryProps {
  summary: Summary;
  liveCreditTotalUsd: number | null;
  liveCashTotalUsd?: number | null;
  liveCupoTotalUsd?: number | null;
  liveMetricsLoading?: boolean;
  lastUpdatedAt?: string | null;
}

export function PaymentsGerenteAccountsSummary({
  summary,
  liveCreditTotalUsd,
  liveCashTotalUsd = null,
  liveCupoTotalUsd = null,
  liveMetricsLoading = false,
  lastUpdatedAt,
}: PaymentsGerenteAccountsSummaryProps) {
  const t = useTranslations("payments");
  const creditHint = (() => {
    const parts: string[] = [];
    if (liveCashTotalUsd != null) {
      parts.push(t("gerenteSummary.cash", { amount: formatMoney(liveCashTotalUsd) }));
    }
    if (liveCupoTotalUsd != null) {
      parts.push(t("gerenteSummary.cupo", { amount: formatMoney(liveCupoTotalUsd) }));
    }
    if (parts.length === 0) {
      return t("gerenteSummary.cashCupoDefault");
    }
    return parts.join(" · ");
  })();

  const items = [
    {
      label: t("gerenteSummary.accounts"),
      value: String(summary.totalAccounts),
      hint: t("gerenteSummary.accountsHint", {
        active: summary.activeCount,
        pending: summary.pendingCount,
      }),
      hintMobile: t("gerenteSummary.accountsHintMobile", {
        active: summary.activeCount,
        pending: summary.pendingCount,
      }),
    },
    {
      label: t("gerenteSummary.tiktokLive"),
      value:
        liveMetricsLoading && liveCreditTotalUsd == null
          ? "…"
          : liveCreditTotalUsd != null
            ? formatMoney(liveCreditTotalUsd)
            : "—",
      hint: creditHint,
      hintMobile:
        liveCupoTotalUsd != null
          ? t("gerenteSummary.cupo", { amount: formatMoney(liveCupoTotalUsd) })
          : liveCashTotalUsd != null
            ? t("gerenteSummary.cash", { amount: formatMoney(liveCashTotalUsd) })
            : t("gerenteSummary.cashCupoShort"),
      accent: true,
    },
    {
      label: t("gerenteSummary.assigned"),
      value: formatMoney(summary.totalLedgerUsd),
      hint: t("gerenteSummary.assignedHint"),
      hintMobile: t("gerenteSummary.assignedHintMobile"),
      muted: true,
    },
    {
      label: t("gerenteSummary.reclaimable"),
      value: String(summary.reclaimableCount),
      hint:
        summary.reclaimableCount > 0
          ? t("gerenteSummary.reclaimableHint")
          : t("gerenteSummary.reclaimableOk"),
      hintMobile:
        summary.reclaimableCount > 0
          ? t("gerenteSummary.reclaimableHintMobile")
          : t("gerenteSummary.reclaimableOkMobile"),
      warn: summary.reclaimableCount > 0,
    },
  ];

  return (
    <div className="border-b border-[var(--auth-border)] bg-[#faf8f5] px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a8178]">
          {t("gerenteSummary.pulse")}
        </p>
        {lastUpdatedAt ? (
          <p className="text-[10px] text-[#b5aea6]">
            {t("gerenteSummary.updated", {
              time: new Date(lastUpdatedAt).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </p>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-lg border border-[rgb(20_18_16_/_0.06)] bg-white px-2.5 py-2 sm:px-3"
          >
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#9a9187] sm:text-[10px]">
              {item.label}
            </p>
            <p
              className={`mt-0.5 truncate text-[14px] font-semibold tabular-nums tracking-[-0.02em] sm:text-[15px] ${
                item.warn
                  ? "text-[#b45309]"
                  : item.accent
                    ? "text-[#1a1612]"
                    : item.muted
                      ? "text-[#6b645c]"
                      : "text-[#1a1612]"
              }`}
            >
              {item.value}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[#9a9187] sm:line-clamp-none">
              <span className="sm:hidden">{item.hintMobile}</span>
              <span className="hidden sm:inline">{item.hint}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
