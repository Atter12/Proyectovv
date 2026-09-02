"use client";

import { formatMoney } from "@/lib/format-money";
import type { summarizePaymentAccounts } from "@/lib/sort/payment-accounts";

type Summary = ReturnType<typeof summarizePaymentAccounts>;

interface PaymentsGerenteAccountsSummaryProps {
  summary: Summary;
  liveCreditTotalUsd: number | null;
  liveMetricsLoading?: boolean;
  lastUpdatedAt?: string | null;
}

export function PaymentsGerenteAccountsSummary({
  summary,
  liveCreditTotalUsd,
  liveMetricsLoading = false,
  lastUpdatedAt,
}: PaymentsGerenteAccountsSummaryProps) {
  const items = [
    {
      label: "Cuentas",
      value: String(summary.totalAccounts),
      hint: `${summary.activeCount} activas · ${summary.pendingCount} pend.`,
    },
    {
      label: "Crédito TikTok",
      value:
        liveMetricsLoading && liveCreditTotalUsd == null
          ? "…"
          : liveCreditTotalUsd != null
            ? formatMoney(liveCreditTotalUsd)
            : "—",
      hint: "Suma cupo gastable (presupuesto − gastado)",
      accent: true,
    },
    {
      label: "Ledger Holistic",
      value: formatMoney(summary.totalLedgerUsd),
      hint: "Saldo asignado en cuentas",
      muted: true,
    },
    {
      label: "Por recuperar",
      value: String(summary.reclaimableCount),
      hint: summary.reclaimableCount > 0 ? "Suspendidas con saldo" : "Todo en orden",
      warn: summary.reclaimableCount > 0,
    },
  ];

  return (
    <div className="border-b border-[var(--auth-border)] bg-[#faf8f5] px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a8178]">
          Pulso de cuentas
        </p>
        {lastUpdatedAt ? (
          <p className="text-[10px] text-[#b5aea6]">
            TikTok actualizado{" "}
            {new Date(lastUpdatedAt).toLocaleTimeString("es-PE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-[rgb(20_18_16_/_0.06)] bg-white px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a9187]">
              {item.label}
            </p>
            <p
              className={`mt-0.5 text-[15px] font-semibold tabular-nums tracking-[-0.02em] ${
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
            <p className="mt-0.5 text-[10px] text-[#9a9187]">{item.hint}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
