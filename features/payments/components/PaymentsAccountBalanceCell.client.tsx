"use client";

import { formatMoney } from "@/lib/format-money";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";

function formatUpdatedAgo(fetchedAt: string | null | undefined): string {
  if (!fetchedAt) return "actualizando…";
  const ms = Date.now() - Date.parse(fetchedAt);
  if (!Number.isFinite(ms) || ms < 0) return "ahora";
  if (ms < 15_000) return "ahora";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.round(sec / 60);
  return `hace ${min} min`;
}

interface PaymentsAccountBalanceCellProps {
  ledgerBalance: number;
  advertiserId?: string | null;
  metric?: AdAccountLiveMetricsClient;
  loading?: boolean;
  /** Gerente BM: muestra gasto de hoy además del cupo. */
  agencyBmFunding?: boolean;
  compact?: boolean;
}

export function PaymentsAccountBalanceCell({
  ledgerBalance,
  advertiserId,
  metric,
  loading = false,
  agencyBmFunding = false,
  compact = false,
}: PaymentsAccountBalanceCellProps) {
  const ledger = Number(ledgerBalance) || 0;
  const hasLedger = ledger > 0.005;

  // Sin ID TikTok: solo queda el ledger Holistic (lo asignado/contabilizado).
  if (!advertiserId) {
    return (
      <div className="min-w-[6.5rem]">
        {hasLedger ? (
          <>
            <p className="text-[13px] font-semibold tabular-nums text-[#1a1612]">
              {formatMoney(ledger)}
            </p>
            <p className="mt-0.5 text-[10px] text-[#9a9187]">Asignado Holistic</p>
          </>
        ) : (
          <span className="text-[12px] text-[#9a9187]">Sin ID TikTok</span>
        )}
      </div>
    );
  }

  if (loading && !metric) {
    return (
      <span className="text-[12px] text-[#9a9187] animate-pulse">TikTok…</span>
    );
  }

  const creditUsd = metric?.balanceUsd;
  const spendToday = metric?.spendTodayUsd;
  const ledgerDiffers =
    creditUsd != null && Math.abs(creditUsd - ledger) > 0.5;

  // Misma fuente que Manager: cupo gastable (presupuesto − gastado / cash).
  // El ledger Holistic es contabilidad de asignaciones, no el saldo de TikTok.
  return (
    <div className={compact ? "min-w-0" : "min-w-[7.5rem]">
      <p className="text-[13px] font-semibold tabular-nums text-[#1a1612]">
        {creditUsd != null
          ? formatMoney(creditUsd)
          : hasLedger
            ? formatMoney(ledger)
            : "—"}
      </p>
      <p className="mt-0.5 text-[10px] text-[#9a9187]">
        {creditUsd != null
          ? agencyBmFunding
            ? "Cupo TikTok"
            : "Saldo TikTok"
          : "Asignado Holistic"}
        {metric?.error ? (
          <span className="ml-1 text-amber-700" title={metric.error}>
            · sin datos
          </span>
        ) : null}
      </p>
      {agencyBmFunding && spendToday != null ? (
        <p className="mt-0.5 text-[10px] text-[#9a9187]">
          Gasto hoy{" "}
          <span className="font-medium tabular-nums text-[#c45a18]">
            {formatMoney(spendToday)}
          </span>
        </p>
      ) : null}
      {hasLedger && (agencyBmFunding || ledgerDiffers || creditUsd == null) ? (
        <p className="mt-1 text-[10px] tabular-nums text-[#b5aea6]">
          Holistic {formatMoney(ledger)}
        </p>
      ) : null}
      {!compact && metric?.fetchedAt ? (
        <p className="mt-0.5 text-[10px] text-[#c8c0b8]">
          {formatUpdatedAgo(metric.fetchedAt)}
        </p>
      ) : null}
    </div>
  );
}
