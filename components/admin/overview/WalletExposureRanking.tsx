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
import { ADMIN_CHART_SERIES } from "@/components/admin/charts/chartTheme";

interface WalletExposureRankingProps {
  data: WalletExposurePoint[];
  currency: string;
  limit?: number;
}

const CONCENTRATION_BADGE: Record<"alta" | "media" | "baja", string> = {
  alta: "border-[#ebc0cc]/70 bg-[#fff0f4] text-[#9a4056]",
  media: "border-[#ecd9a0]/70 bg-[#fff8e8] text-[#8a6010]",
  baja: "border-[#b5e5d4]/70 bg-[#f3fff9] text-[#1a7560]",
};

function activeOrganizationsLabel(count: number): string {
  if (count === 1) return "1 organización con saldo activo";
  return `${count} organizaciones con saldo activo`;
}

export function WalletExposureRanking({ data, currency, limit = 5 }: WalletExposureRankingProps) {
  const insights = buildWalletExposureInsights(data, limit);

  if (insights.ranked.length === 0) {
    return (
      <div className="flex min-h-[5rem] items-center justify-center rounded-xl border border-dashed border-[#cfe8ee] bg-white/50 px-4 py-5 text-center text-sm font-bold text-[#789bad]">
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
      <p className="text-xs font-semibold leading-5 text-[#587080]">{summaryParts.join(" · ")}</p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className={`inline-flex rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold tracking-normal ${CONCENTRATION_BADGE[insights.concentrationLevel]}`}
        >
          Concentración {concentrationLabel.toLowerCase()}
        </span>
        <span className="text-xs font-semibold tabular-nums text-[#546a78]">
          Top wallet {formatConcentrationShare(insights.topConcentrationShare)}
        </span>
      </div>

      <div className="divide-y divide-[#e8f2f6] rounded-xl border border-[#e1edf2] bg-white/55">
        {insights.ranked.map((item) => (
          <div key={item.organizationId} className="space-y-1 px-3 py-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2.5">
              <p
                className="truncate text-xs font-extrabold text-[#365c6d]"
                title={formatOrganizationDisplayName(item.organizationName)}
              >
                {formatOrganizationDisplayName(item.organizationName)}
              </p>
              <p className="text-right text-[0.68rem] font-black tabular-nums text-[#061925] sm:text-xs">
                {formatMoney(item.exposureCents, currency)}
              </p>
              <p className="min-w-[3rem] text-right text-[0.68rem] font-black tabular-nums text-[#0e7490] sm:text-xs">
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

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-[0.6875rem] font-medium text-[#6d8494]">
          {activeOrganizationsLabel(insights.activeWalletOrganizationsCount)}
          {insights.totalReserved > 0
            ? ` · ${formatMoney(insights.totalReserved, currency)} reservado`
            : ""}
        </p>
        <Link
          href="/admin/organizations"
          className="shrink-0 text-xs font-semibold text-[#0e7490] transition hover:text-[#59c493]"
        >
          Ver organizaciones
        </Link>
      </div>
    </div>
  );
}
