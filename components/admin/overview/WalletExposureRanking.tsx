"use client";

import type { WalletExposurePoint } from "@/lib/admin/data";
import { buildWalletExposureInsights, formatOrganizationDisplayName } from "@/lib/admin/chartUtils";
import { formatMoney } from "@/lib/format";
import { ADMIN_CHART_SERIES } from "@/components/admin/charts/chartTheme";

interface WalletExposureRankingProps {
  data: WalletExposurePoint[];
  currency: string;
  limit?: number;
}

function formatConcentrationShare(share: number): string {
  if (share > 0 && share < 0.1) return "<0.1%";
  return `${share.toFixed(1)}%`;
}

function activeOrganizationsLabel(count: number): string {
  if (count === 1) return "1 organización con saldo activo";
  return `${count} organizaciones con saldo activo`;
}

export function WalletExposureRanking({ data, currency, limit = 5 }: WalletExposureRankingProps) {
  const insights = buildWalletExposureInsights(data, limit);

  if (insights.ranked.length === 0) {
    return (
      <div className="flex min-h-[5.5rem] items-center justify-center rounded-xl border border-dashed border-[#cfe8ee] bg-white/50 px-4 py-6 text-center text-sm font-bold text-[#789bad]">
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

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-bold leading-5 text-[#587080]">{summaryParts.join(" · ")}</p>

      <div className="divide-y divide-[#e8f2f6] rounded-xl border border-[#e1edf2] bg-white/55">
        {insights.ranked.map((item) => (
          <div key={item.organizationId} className="space-y-1.5 px-3 py-2.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3">
              <p
                className="truncate text-xs font-extrabold text-[#365c6d]"
                title={formatOrganizationDisplayName(item.organizationName)}
              >
                {formatOrganizationDisplayName(item.organizationName)}
              </p>
              <p className="text-right text-[0.68rem] font-black tabular-nums text-[#061925] sm:text-xs">
                {formatMoney(item.exposureCents, currency)}
              </p>
              <p className="min-w-[3.25rem] text-right text-[0.68rem] font-black tabular-nums text-[#0e7490] sm:text-xs">
                {formatConcentrationShare(item.concentrationShare)}
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#e8f2f6]">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(item.concentrationShare, item.concentrationShare > 0 ? 4 : 0)}%`,
                  backgroundColor: ADMIN_CHART_SERIES.available,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-0.5 pt-0.5">
        <p className="text-[0.66rem] font-bold text-[#6d8494]">
          {activeOrganizationsLabel(insights.activeWalletOrganizationsCount)}
        </p>
        {insights.totalReserved === 0 ? (
          <p className="text-[0.66rem] font-semibold text-[#9ab0bc]">Sin saldo reservado actualmente.</p>
        ) : (
          <p className="text-[0.66rem] font-semibold text-[#9ab0bc]">
            {formatMoney(insights.totalReserved, currency)} en reserva distribuidos entre las organizaciones activas.
          </p>
        )}
      </div>
    </div>
  );
}
