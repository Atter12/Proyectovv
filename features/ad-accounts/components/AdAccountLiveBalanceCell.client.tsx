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

export function AdAccountLiveBalanceCell({
  advertiserId,
  metric,
  loading,
}: {
  advertiserId: string | null | undefined;
  metric?: AdAccountLiveMetricsClient;
  loading?: boolean;
}) {
  if (!advertiserId) {
    return <span className="text-[12px] text-[#9a9187]">—</span>;
  }

  if (loading && !metric) {
    return (
      <span className="text-[12px] text-[#9a9187] animate-pulse">
        Cargando…
      </span>
    );
  }

  if (metric?.error) {
    return (
      <span className="text-[11px] text-amber-700" title={metric.error}>
        Sin datos
      </span>
    );
  }

  if (metric?.balanceUsd == null && metric?.spendTodayUsd == null) {
    return <span className="text-[12px] text-[#9a9187]">—</span>;
  }

  return (
    <div className="min-w-[7rem]">
      <p className="text-[13px] font-semibold tabular-nums text-[#1a1612]">
        {metric?.balanceUsd != null ? formatMoney(metric.balanceUsd) : "—"}
      </p>
      <p className="mt-0.5 text-[10px] text-[#9a9187]">
        Gasto hoy{" "}
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
