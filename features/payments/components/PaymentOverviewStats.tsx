"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAppFormatter } from "@/lib/i18n/use-app-formatter";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import {
  isTikTokBudgetCupoBalance,
} from "@/features/ad-accounts/lib/classify-tiktok-live-balance";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";
import type { HecomFinanceSnapshot } from "@/features/payments/types/hecom-finance-snapshot";
import type { PaymentGateway, PaymentPageCore } from "@/types/payment";

export interface PaymentAllocationSummary {
  totalAccounts: number;
  activeCount: number;
  pendingCount: number;
  reclaimableCount: number;
  totalLedgerUsd: number;
}

interface PaymentOverviewStatsProps {
  wallet: PaymentPageCore["wallet"];
  summary: PaymentPageCore["summary"];
  activeGateway: PaymentGateway;
  isStaff?: boolean;
  /** CRM del cliente en alcance (saldo estimado, cobros, etc.) */
  hecomFinance?: HecomFinanceSnapshot | null;
  /** Resumen de cuentas en tabla de asignación (modo gerente). */
  allocationSummary?: PaymentAllocationSummary | null;
  /** Advertisers del cliente: suma saldo TikTok en vivo. */
  advertiserIds?: string[];
}

/**
 * Resumen de pagos — grilla clara.
 * Cliente: cartera Holistic + disponible TikTok + modalidad.
 * Gerente BM: KPIs de cuentas.
 */
export function PaymentOverviewStats({
  wallet,
  summary,
  activeGateway,
  isStaff = false,
  hecomFinance = null,
  allocationSummary = null,
  advertiserIds = [],
}: PaymentOverviewStatsProps) {
  const t = useTranslations("payments");
  const { formatMoney, formatNumber } = useAppFormatter();
  const { agencyBmFunding } = usePaymentsFundingMode();
  const hecomMode = isStaff && agencyBmFunding && hecomFinance != null;
  const liveEnabled = !hecomMode && advertiserIds.length > 0;
  const live = useAdAccountLiveMetrics(liveEnabled);

  const tiktokCoverage = useMemo(() => {
    if (!liveEnabled) {
      return {
        cashTotal: null as number | null,
        cupoTotal: null as number | null,
        cashCount: 0,
        cupoCount: 0,
        withBalance: 0,
        expected: 0,
      };
    }
    let cashTotal = 0;
    let cupoTotal = 0;
    let cashCount = 0;
    let cupoCount = 0;
    let withBalance = 0;
    for (const id of advertiserIds) {
      const metric = live.metricsByAdvertiser[id];
      if (metric?.balanceUsd == null) continue;
      withBalance += 1;
      if (isTikTokBudgetCupoBalance(metric)) {
        cupoTotal += metric.balanceUsd;
        cupoCount += 1;
      } else {
        // cash (NON_SHARED) o unknown: no ocultar BM200 si falta portfolio
        cashTotal += metric.balanceUsd;
        cashCount += 1;
      }
    }
    return {
      cashTotal: cashCount > 0 ? Math.round(cashTotal * 100) / 100 : null,
      cupoTotal: cupoCount > 0 ? Math.round(cupoTotal * 100) / 100 : null,
      cashCount,
      cupoCount,
      withBalance,
      expected: advertiserIds.length,
    };
  }, [advertiserIds, live.metricsByAdvertiser, liveEnabled]);

  const tiktokAvailableUsd = tiktokCoverage.cashTotal;
  const tiktokPartial =
    tiktokCoverage.expected > 0 &&
    tiktokCoverage.withBalance > 0 &&
    tiktokCoverage.withBalance < tiktokCoverage.expected;
  const tiktokStale = advertiserIds.some(
    (id) => live.metricsByAdvertiser[id]?.stale,
  );

  const modality = hecomFinance?.billingModality ?? null;
  const modalityLabel =
    modality === "credito"
      ? t("stats.modalityCredit")
      : modality === "prepago"
        ? t("stats.modalityPrepaid")
        : null;
  const modalityHint =
    modality === "credito"
      ? t("stats.modalityCreditHint")
      : modality === "prepago"
        ? t("stats.modalityPrepaidHint")
        : t("stats.modalityNone");

  const feePercent = hecomFinance?.depositFeePercent ?? 10;

  const items = hecomMode
    ? [
        {
          label: t("stats.holisticWallet"),
          value: formatMoney(wallet.balance, wallet.currency),
          hint: t("stats.holisticHintStaff"),
          accent: true as boolean,
          warn: false,
        },
        {
          label: t("stats.activeAccounts"),
          value: String(
            allocationSummary?.activeCount ??
              summary.accountsReadyForAllocation,
          ),
          hint: t("stats.activeAccountsHint", {
            total: allocationSummary?.totalAccounts ?? "—",
            pending: allocationSummary?.pendingCount ?? 0,
          }),
          accent: false,
          warn: false,
        },
        {
          label: t("stats.reclaimable"),
          value: String(allocationSummary?.reclaimableCount ?? 0),
          hint:
            (allocationSummary?.reclaimableCount ?? 0) > 0
              ? t("stats.reclaimableHint")
              : t("stats.reclaimableNone"),
          accent: false,
          warn: (allocationSummary?.reclaimableCount ?? 0) > 0,
        },
        {
          label: t("stats.modality"),
          value: modalityLabel ?? "—",
          hint:
            modality === "credito"
              ? t("stats.modalityFeeCobranza", { percent: feePercent })
              : t("stats.modalityFee", { percent: feePercent }),
          accent: false,
          warn: false,
        },
      ]
    : [
        {
          label: t("stats.holisticWallet"),
          value: formatMoney(wallet.balance, wallet.currency),
          hint: t("stats.holisticHintClient"),
          accent: true as boolean,
          warn: false,
        },
        {
          label: t("stats.tiktokBalance"),
          value:
            tiktokAvailableUsd != null
              ? formatMoney(tiktokAvailableUsd, "USD")
              : live.loading
                ? "…"
                : tiktokCoverage.cupoTotal != null
                  ? "$0"
                  : "—",
          hint:
            tiktokAvailableUsd != null
              ? [
                  tiktokPartial
                    ? t("stats.tiktokPartial", {
                        with: tiktokCoverage.withBalance,
                        expected: tiktokCoverage.expected,
                      })
                    : t("stats.tiktokCashHint"),
                  tiktokCoverage.cupoTotal != null
                    ? t("stats.tiktokCupoHint", {
                        amount: formatMoney(tiktokCoverage.cupoTotal, "USD"),
                      })
                    : null,
                  tiktokStale ? t("stats.tiktokStale") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : tiktokCoverage.cupoTotal != null
                ? t("stats.tiktokNoCashCupo", {
                    amount: formatMoney(tiktokCoverage.cupoTotal, "USD"),
                  })
                : t("stats.tiktokDefaultHint"),
          accent: true,
          warn: tiktokPartial || tiktokCoverage.cupoTotal != null,
        },
        {
          label: t("stats.modality"),
          value: modalityLabel ?? "—",
          hint: modalityHint,
          accent: false,
          warn: modality === "credito",
        },
        {
          label: t("stats.gateway"),
          value: activeGateway.name,
          hint: t("stats.gatewayHint", {
            count: formatNumber(summary.accountsReadyForAllocation),
          }),
          accent: false,
          warn: false,
        },
      ];

  return (
    <section aria-label={t("stats.aria")} className="space-y-3">
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
          {t("stats.eyebrow")}
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-[#5c564e]">
          {hecomMode ? t("stats.subtitleStaff") : t("stats.subtitleClient")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="relative overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white px-4 py-3.5 shadow-[0_10px_28px_-20px_rgb(28_25_23_/_0.16)]"
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,#ff781f,#ffa12c,transparent)] opacity-90"
            />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              {item.label}
            </p>
            <p
              className={`mt-1.5 truncate text-[1.15rem] font-bold tracking-[-0.03em] tabular-nums ${
                item.warn
                  ? "text-[#b45309]"
                  : "muted" in item && item.muted
                    ? "text-[#6b645c]"
                    : item.accent
                      ? "text-[#ff781f]"
                      : "text-[#1c1917]"
              }`}
            >
              {item.value}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#5c564e]">
              {item.hint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
