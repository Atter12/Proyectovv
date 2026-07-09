"use client";

import type { WalletExposurePoint } from "@/lib/admin/data";
import {
  filterWalletExposureWithBalance,
  formatOrganizationDisplayName,
  summarizeWalletExposure,
} from "@/lib/admin/chartUtils";
import { formatMoney } from "@/lib/format";
import { ADMIN_CHART_SERIES } from "@/components/admin/charts/chartTheme";

interface WalletExposureRankingProps {
  data: WalletExposurePoint[];
  currency: string;
  limit?: number;
}

export function WalletExposureRanking({ data, currency, limit = 5 }: WalletExposureRankingProps) {
  const ranked = filterWalletExposureWithBalance(data, limit);
  const totals = summarizeWalletExposure(data);
  const hasReserved = ranked.some((item) => item.reservedCents > 0);
  const maxExposureCents = ranked.reduce(
    (max, item) => Math.max(max, item.availableCents + item.reservedCents),
    0,
  );

  if (ranked.length === 0) {
    return (
      <div className="flex min-h-[7rem] items-center justify-center rounded-2xl border border-dashed border-[#cfe8ee] bg-white/50 px-4 text-center text-sm font-bold text-[#789bad]">
        Sin exposición financiera activa.
      </div>
    );
  }

  const summaryParts = [
    `${formatMoney(totals.availableCents, currency)} disponible`,
    `${formatMoney(totals.reservedCents, currency)} reservado`,
  ];

  if (totals.topOrganizationName) {
    summaryParts.push(`Top: ${formatOrganizationDisplayName(totals.topOrganizationName)}`);
  }

  const rowHeight = 2.35;
  const blockHeight = Math.min(14, 3.2 + ranked.length * rowHeight);

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold leading-5 text-[#587080]">{summaryParts.join(" · ")}</p>

      <div className="space-y-2.5" style={{ minHeight: `${blockHeight}rem` }}>
        {ranked.map((item) => {
          const totalCents = item.availableCents + item.reservedCents;
          const availablePct = maxExposureCents > 0 ? (item.availableCents / maxExposureCents) * 100 : 0;
          const reservedPct = maxExposureCents > 0 ? (item.reservedCents / maxExposureCents) * 100 : 0;

          return (
            <div key={item.organizationId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,7.5rem)_auto_minmax(0,1fr)]">
              <p
                className="truncate text-xs font-extrabold text-[#365c6d]"
                title={formatOrganizationDisplayName(item.organizationName)}
              >
                {formatOrganizationDisplayName(item.organizationName)}
              </p>
              <p className="text-right text-[0.68rem] font-black tabular-nums text-[#061925] sm:text-xs">
                {formatMoney(totalCents, currency)}
              </p>
              <div className="col-span-2 flex h-2 overflow-hidden rounded-full bg-[#e8f2f6] sm:col-span-1">
                {availablePct > 0 ? (
                  <span
                    className="h-full"
                    style={{ width: `${availablePct}%`, backgroundColor: ADMIN_CHART_SERIES.available }}
                  />
                ) : null}
                {reservedPct > 0 ? (
                  <span
                    className="h-full"
                    style={{ width: `${reservedPct}%`, backgroundColor: ADMIN_CHART_SERIES.reserved }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {hasReserved ? (
        <div className="flex flex-wrap items-center gap-3 text-[0.66rem] font-bold text-[#789bad]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ADMIN_CHART_SERIES.available }} />
            Disponible
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ADMIN_CHART_SERIES.reserved }} />
            Reservado
          </span>
        </div>
      ) : (
        <p className="text-[0.66rem] font-semibold text-[#9ab0bc]">Sin saldo reservado en el período actual.</p>
      )}
    </div>
  );
}
