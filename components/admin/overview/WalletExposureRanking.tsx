"use client";

import Link from "next/link";
import type { WalletExposurePoint } from "@/lib/admin/data";
import {
  buildWalletExposureInsights,
  formatConcentrationShare,
  formatOrganizationDisplayName,
  formatWalletConcentrationLevelLabel,
} from "@/lib/admin/chartUtils";
import { formatMoney } from "@/lib/format";
import { getAdminChartSeries, getAdminChartTheme } from "@/components/admin/charts/chartTheme";
import { useAdminChartThemeMode } from "@/components/admin/charts/useAdminChartTheme";

interface WalletExposureRankingProps {
  data: WalletExposurePoint[];
  currency: string;
  limit?: number;
}

const CONCENTRATION_BADGE: Record<"alta" | "media" | "baja", string> = {
  alta: "border-[var(--admin-danger)]/30 bg-[var(--admin-badge-danger-bg)] text-[var(--admin-badge-danger-text)]",
  media: "border-[var(--admin-warning)]/30 bg-[var(--admin-badge-warning-bg)] text-[var(--admin-badge-warning-text)]",
  baja: "border-[var(--admin-success)]/30 bg-[var(--admin-badge-success-bg)] text-[var(--admin-badge-success-text)]",
};

function activeOrganizationsLabel(count: number): string {
  if (count === 1) return "1 organización con saldo activo";
  return `${count} organizaciones con saldo activo`;
}

export function WalletExposureRanking({ data, currency, limit = 5 }: WalletExposureRankingProps) {
  const themeMode = useAdminChartThemeMode();
  const chartTheme = getAdminChartTheme(themeMode);
  const chartSeries = getAdminChartSeries(chartTheme);
  const insights = buildWalletExposureInsights(data, limit);

  if (insights.ranked.length === 0) {
    return (
      <div className="flex min-h-[5rem] items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-soft)]/50 px-4 py-5 text-center text-sm font-semibold text-[var(--admin-text-muted)]">
        Sin exposición financiera activa.
      </div>
    );
  }

  const summaryParts = [
    `${formatMoney(insights.totalAvailable, currency)} disponible`,
    `${formatMoney(insights.totalReserved, currency)} reservado`,
  ];

  if (insights.topOrganizationName) {
    summaryParts.push(`Top: ${formatOrganizationDisplayName(insights.topOrganizationName)}`);
  }

  const concentrationLabel = formatWalletConcentrationLevelLabel(insights.concentrationLevel);

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold leading-5 text-[var(--admin-text-muted)]">{summaryParts.join(" · ")}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`inline-flex rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold tracking-normal ${CONCENTRATION_BADGE[insights.concentrationLevel]}`}
        >
          Concentración {concentrationLabel.toLowerCase()}
        </span>
        <span className="text-xs font-semibold tabular-nums text-[var(--admin-text-muted)]">
          Top wallet {formatConcentrationShare(insights.topConcentrationShare)}
        </span>
      </div>

      <div className="divide-y divide-[var(--admin-table-divider)] rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-soft)]/80">
        {insights.ranked.map((item) => (
          <div key={item.organizationId} className="space-y-1 px-3 py-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2.5">
              <p
                className="truncate text-xs font-bold text-[var(--admin-text)]"
                title={formatOrganizationDisplayName(item.organizationName)}
              >
                {formatOrganizationDisplayName(item.organizationName)}
              </p>
              <p className="text-right text-[0.68rem] font-bold tabular-nums text-[var(--admin-text)] sm:text-xs">
                {formatMoney(item.exposureCents, currency)}
              </p>
              <p className="min-w-[3rem] text-right text-[0.68rem] font-bold tabular-nums text-[var(--admin-accent)] sm:text-xs">
                {formatConcentrationShare(item.concentrationShare)}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-border)]">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(item.concentrationShare, item.concentrationShare > 0 ? 4 : 0)}%`,
                  backgroundColor: chartSeries.available,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[0.6875rem] font-medium text-[var(--admin-text-muted)]">
          {activeOrganizationsLabel(insights.activeWalletOrganizationsCount)}
          {insights.totalReserved > 0
            ? ` · ${formatMoney(insights.totalReserved, currency)} reservado`
            : ""}
        </p>
        <Link
          href="/admin/organizations"
          className="shrink-0 text-xs font-semibold text-[var(--admin-accent)] transition hover:text-[var(--admin-accent-hover)]"
        >
          Ver organizaciones
        </Link>
      </div>
    </div>
  );
}
