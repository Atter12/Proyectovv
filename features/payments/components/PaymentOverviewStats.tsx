"use client";

import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import { useMemo } from "react";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
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
  const { agencyBmFunding } = usePaymentsFundingMode();
  const hecomMode = isStaff && agencyBmFunding && hecomFinance != null;
  const liveEnabled = !hecomMode && advertiserIds.length > 0;
  const live = useAdAccountLiveMetrics(liveEnabled);

  const tiktokAvailableUsd = useMemo(() => {
    if (!liveEnabled) return null;
    let total = 0;
    let any = false;
    for (const id of advertiserIds) {
      const metric = live.metricsByAdvertiser[id];
      if (metric?.balanceUsd != null) {
        total += metric.balanceUsd;
        any = true;
      }
    }
    return any ? Math.round(total * 100) / 100 : null;
  }, [advertiserIds, live.metricsByAdvertiser, liveEnabled]);

  const modality = hecomFinance?.billingModality ?? null;
  const modalityLabel =
    modality === "credito"
      ? "Crédito"
      : modality === "prepago"
        ? "Prepago"
        : null;
  const modalityHint =
    modality === "credito"
      ? "Hecom Club · paga según cobranza / fin de ciclo"
      : modality === "prepago"
        ? "Recarga antes de gastar (Stripe / manual)"
        : "Sin dato Hecom";

  const items = hecomMode
    ? [
        {
          label: "Cuentas activas",
          value: String(
            allocationSummary?.activeCount ??
              summary.accountsReadyForAllocation,
          ),
          hint: `${allocationSummary?.totalAccounts ?? "—"} en lista · ${allocationSummary?.pendingCount ?? 0} pend.`,
          accent: true as boolean,
          warn: false,
        },
        {
          label: "Ledger en cuentas",
          value:
            allocationSummary != null
              ? formatMoney(allocationSummary.totalLedgerUsd, "USD")
              : "—",
          hint: "Holistic asignado (no TikTok)",
          accent: false,
          warn: false,
          muted: true,
        },
        {
          label: "Por recuperar",
          value: String(allocationSummary?.reclaimableCount ?? 0),
          hint:
            (allocationSummary?.reclaimableCount ?? 0) > 0
              ? "Suspendidas con saldo"
              : "Sin pendientes",
          accent: false,
          warn: (allocationSummary?.reclaimableCount ?? 0) > 0,
        },
        {
          label: "Modalidad",
          value: modalityLabel ?? "—",
          hint:
            modality === "credito"
              ? `Fee ${hecomFinance?.depositFeePercent ?? 10}% · cobranza`
              : `Fee ${hecomFinance?.depositFeePercent ?? 10}%`,
          accent: false,
          warn: false,
        },
      ]
    : [
        {
          label: "Cartera Holistic",
          value: formatMoney(wallet.balance, wallet.currency),
          hint: "Disponible para asignar a ads",
          accent: true as boolean,
          warn: false,
        },
        {
          label: "Disponible TikTok",
          value:
            tiktokAvailableUsd != null
              ? formatMoney(tiktokAvailableUsd, "USD")
              : live.loading
                ? "…"
                : "—",
          hint:
            tiktokAvailableUsd != null
              ? "Suma cupo gastable en Manager"
              : "Saldo en vivo de las cuentas",
          accent: true,
          warn: false,
        },
        {
          label: "Modalidad",
          value: modalityLabel ?? "—",
          hint: modalityHint,
          accent: false,
          warn: modality === "credito",
        },
        {
          label: "Pasarela",
          value: activeGateway.name,
          hint: `${formatNumber(summary.accountsReadyForAllocation)} cuentas listas`,
          accent: false,
          warn: false,
        },
      ];

  return (
    <section aria-label="Resumen de pagos" className="space-y-3">
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
          Resumen
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-[#5c564e]">
          {hecomMode
            ? "Estado de cuentas y asignación BM"
            : "Cartera Holistic vs saldo TikTok (Manager)"}
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
