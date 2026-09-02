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
  /** Gerente BM: crédito TikTok primero, ledger secundario. */
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
  if (!agencyBmFunding) {
    return (
      <span className="text-[13px] font-semibold tabular-nums text-[#1a1612]">
        {formatMoney(ledgerBalance)}
      </span>
    );
  }

  const ledger = Number(ledgerBalance) || 0;
  const hasLedger = ledger > 0.005;

  if (!advertiserId) {
    return (
      <div className="min-w-[6.5rem]">
        {hasLedger ? (
          <p className="text-[12px] tabular-nums text-[#6b645c]">
            Ledger {formatMoney(ledger)}
          </p>
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

  return (
    <div className={compact ? "min-w-0" : "min-w-[7.5rem]"}>
      <p className="text-[13px] font-medium tabular-nums text-[#1a1612]">
        {creditUsd != null ? formatMoney(creditUsd) : "—"}
      </p>
      <p className="mt-0.5 text-[10px] text-[#9a9187]">
        Cupo gastable
        {metric?.error ? (
          <span className="ml-1 text-amber-700" title={metric.error}>
            · sin datos
          </span>
        ) : null}
      </p>
      {spendToday != null ? (
        <p className="mt-0.5 text-[10px] text-[#9a9187]">
          Gasto hoy{" "}
          <span className="font-medium tabular-nums text-[#c45a18]">
            {formatMoney(spendToday)}
          </span>
        </p>
      ) : null}
      {hasLedger ? (
        <p className="mt-1 text-[10px] tabular-nums text-[#b5aea6]">
          Ledger {formatMoney(ledger)}
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
