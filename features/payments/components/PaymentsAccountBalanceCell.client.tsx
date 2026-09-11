"use client";

import { formatMoney } from "@/lib/format-money";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import {
  formatTikTokBudgetLimitLine,
  formatTikTokBudgetLimitParts,
} from "@/features/ad-accounts/lib/format-tiktok-budget-limit";
import { tikTokLiveBalanceLabel } from "@/features/ad-accounts/lib/classify-tiktok-live-balance";

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

  if (!advertiserId) {
    return (
      <div className={compact ? "min-w-0" : "min-w-[6.5rem]"}>
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
  const budgetParts = compact ? formatTikTokBudgetLimitParts(metric) : null;
  const budgetLimitLine = compact ? null : formatTikTokBudgetLimitLine(metric);
  const balanceLabel = tikTokLiveBalanceLabel(metric, { agencyBmFunding });
  const ledgerDiffers =
    creditUsd != null && Math.abs(creditUsd - ledger) > 0.5;

  return (
    <div className={compact ? "min-w-0 w-full" : "min-w-[7.5rem]"}>
      <div
        className={
          compact
            ? "flex items-baseline justify-between gap-3"
            : undefined
        }
      >
        <div className="min-w-0">
          <p
            className={`font-semibold tabular-nums text-[#1a1612] ${
              compact ? "text-[16px] tracking-[-0.02em]" : "text-[13px]"
            }`}
          >
            {creditUsd != null
              ? formatMoney(creditUsd)
              : hasLedger
                ? formatMoney(ledger)
                : "—"}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-[#9a9187]">
            {creditUsd != null ? balanceLabel : "Asignado Holistic"}
            {metric?.error ? (
              <span className="ml-1 text-amber-700" title={metric.error}>
                · sin datos
              </span>
            ) : null}
          </p>
        </div>
        {compact && agencyBmFunding && spendToday != null ? (
          <p className="shrink-0 text-right text-[10px] leading-4 text-[#9a9187]">
            Gasto hoy
            <br />
            <span className="font-semibold tabular-nums text-[#c45a18]">
              {formatMoney(spendToday)}
            </span>
          </p>
        ) : null}
      </div>

      {budgetParts?.kind === "unlimited" ? (
        <p className="mt-1.5 text-[10px] leading-4 text-[#6b645c]">
          Presupuesto ilimitado
        </p>
      ) : null}
      {budgetParts?.kind === "limited" ? (
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-[#f7f3ee] px-2 py-1.5 text-center">
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#9a9187]">
              Tope
            </p>
            <p className="mt-0.5 truncate text-[10px] font-semibold tabular-nums text-[#6b645c]">
              {budgetParts.budget}
            </p>
          </div>
          <div className="min-w-0 border-x border-[rgb(20_18_16_/_0.06)]">
            <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#9a9187]">
              Gastado
            </p>
            <p className="mt-0.5 truncate text-[10px] font-semibold tabular-nums text-[#6b645c]">
              {budgetParts.used}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-medium uppercase tracking-[0.06em] text-[#9a9187]">
              Queda
            </p>
            <p className="mt-0.5 truncate text-[10px] font-semibold tabular-nums text-[#6b645c]">
              {budgetParts.left}
            </p>
          </div>
        </div>
      ) : null}

      {budgetLimitLine ? (
        <p className="mt-0.5 text-[10px] leading-4 tabular-nums text-[#6b645c]">
          {budgetLimitLine}
        </p>
      ) : null}

      {!compact && agencyBmFunding && spendToday != null ? (
        <p className="mt-0.5 text-[10px] leading-4 text-[#9a9187]">
          Gasto hoy{" "}
          <span className="font-medium tabular-nums text-[#c45a18]">
            {formatMoney(spendToday)}
          </span>
        </p>
      ) : null}

      {hasLedger &&
      creditUsd != null &&
      (agencyBmFunding || ledgerDiffers) ? (
        <p
          className={`mt-0.5 text-[10px] leading-4 tabular-nums text-[#b5aea6] ${
            compact ? "mt-1.5" : ""
          }`}
        >
          Holistic {formatMoney(ledger)}
        </p>
      ) : null}

      {!compact && metric?.fetchedAt ? (
        <p className="mt-0.5 text-[10px] leading-4 text-[#c8c0b8]">
          {formatUpdatedAgo(metric.fetchedAt)}
        </p>
      ) : null}
    </div>
  );
}
