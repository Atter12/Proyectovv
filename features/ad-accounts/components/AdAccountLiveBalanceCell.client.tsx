"use client";

import { useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format-money";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { classifyTikTokLiveBalance } from "@/features/ad-accounts/lib/classify-tiktok-live-balance";

export function AdAccountLiveBalanceCell({
  advertiserId,
  metric,
  loading,
  agencyBmFunding = false,
}: {
  advertiserId: string | null | undefined;
  metric?: AdAccountLiveMetricsClient;
  loading?: boolean;
  agencyBmFunding?: boolean;
}) {
  const t = useTranslations("adAccounts.live");

  function formatUpdatedAgo(fetchedAt: string | null | undefined): string {
    if (!fetchedAt) return t("updating");
    const ms = Date.now() - Date.parse(fetchedAt);
    if (!Number.isFinite(ms) || ms < 0) return t("now");
    if (ms < 15_000) return t("now");
    const sec = Math.round(ms / 1000);
    if (sec < 60) return t("agoSeconds", { seconds: sec });
    const min = Math.round(sec / 60);
    return t("agoMinutes", { minutes: min });
  }

  if (!advertiserId) {
    return <span className="text-[12px] text-[#9a9187]">—</span>;
  }

  if (loading && !metric) {
    return (
      <span className="text-[12px] text-[#9a9187] animate-pulse">
        {t("loading")}
      </span>
    );
  }

  if (metric?.error) {
    return (
      <span className="text-[11px] text-amber-700" title={metric.error}>
        {t("noData")}
      </span>
    );
  }

  if (metric?.balanceUsd == null && metric?.spendTodayUsd == null) {
    return <span className="text-[12px] text-[#9a9187]">—</span>;
  }

  const kind = classifyTikTokLiveBalance(metric);
  const balanceLabel =
    kind === "budget_cupo"
      ? t("balanceCupo")
      : kind === "unknown" && agencyBmFunding
        ? t("balanceCupoUnknown")
        : t("balanceCash");

  let budgetLimitLine: string | null = null;
  if (metric?.showBudgetLimit && metric.isUnlimitedBudget) {
    budgetLimitLine = t("budgetUnlimited");
  } else if (metric?.showBudgetLimit && metric.budgetUsd != null) {
    const used = metric.budgetCostUsd ?? 0;
    const left =
      metric.balanceUsd != null
        ? metric.balanceUsd
        : Math.max(0, Math.round((metric.budgetUsd - used) * 100) / 100);
    budgetLimitLine = t("budgetLine", {
      budget: formatMoney(metric.budgetUsd),
      spent: formatMoney(used),
      left: formatMoney(left),
    });
  }

  return (
    <div className="min-w-[7rem]">
      <p className="text-[13px] font-semibold tabular-nums text-[#1a1612]">
        {metric?.balanceUsd != null ? formatMoney(metric.balanceUsd) : "—"}
      </p>
      <p className="mt-0.5 text-[10px] text-[#9a9187]">{balanceLabel}</p>
      {budgetLimitLine ? (
        <p className="mt-0.5 text-[10px] leading-4 tabular-nums text-[#6b645c]">
          {budgetLimitLine}
        </p>
      ) : null}
      <p className="mt-0.5 text-[10px] text-[#9a9187]">
        {t("spendToday")}{" "}
        <span className="font-semibold tabular-nums text-[#c45a18]">
          {metric?.spendTodayUsd != null
            ? formatMoney(metric.spendTodayUsd)
            : "—"}
        </span>
      </p>
      <p className="mt-0.5 text-[10px] text-[#b5aea6]">
        {formatUpdatedAgo(metric?.fetchedAt)}
      </p>
    </div>
  );
}
