"use client";

import { useMemo, useState } from "react";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker.client";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import {
  buildDailySeriesFromCampaignRows,
  filterCampaignSpendRows,
  getCampaignSpendDateBounds,
  listCampaignsBySpend,
  listUniqueBms,
  sumCampaignSpend,
  type HecomCampaignSpendRow,
} from "@/lib/hecom/campaign-spend";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { moneyUsd } from "@/lib/format/money-usd";

const ALL_BMS = "__all_bms__";
const ALL_CAMPAIGNS = "__all_campaigns__";

function defaultRange(bounds: { min: string | null; max: string | null }) {
  if (bounds.min && bounds.max) {
    return { start: bounds.min, end: bounds.max };
  }
  const today = todayYmdInTz();
  return { start: shiftYmd(today, -29), end: today };
}

function shortDayLabel(dateYmd: string) {
  const iso = dateYmd.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return dateYmd;
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function CampaignSpendExplorer({
  rows,
}: {
  rows: HecomCampaignSpendRow[];
}) {
  const bounds = useMemo(() => getCampaignSpendDateBounds(rows), [rows]);
  const initialRange = useMemo(() => defaultRange(bounds), [bounds]);
  const bms = useMemo(() => listUniqueBms(rows), [rows]);

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedBm, setSelectedBm] = useState(ALL_BMS);
  const [selectedCampaign, setSelectedCampaign] = useState(ALL_CAMPAIGNS);

  const inDateRange = useMemo(
    () =>
      filterCampaignSpendRows(rows, {
        startDate,
        endDate,
      }),
    [rows, startDate, endDate],
  );

  const bmFiltered = useMemo(
    () =>
      filterCampaignSpendRows(inDateRange, {
        bm: selectedBm === ALL_BMS ? null : selectedBm,
      }),
    [inDateRange, selectedBm],
  );

  const campaigns = useMemo(
    () => listCampaignsBySpend(bmFiltered),
    [bmFiltered],
  );

  const chartRows = useMemo(
    () =>
      filterCampaignSpendRows(bmFiltered, {
        campaignName:
          selectedCampaign === ALL_CAMPAIGNS ? null : selectedCampaign,
      }),
    [bmFiltered, selectedCampaign],
  );

  const series = useMemo(
    () => buildDailySeriesFromCampaignRows(chartRows),
    [chartRows],
  );

  const periodTotalAll = useMemo(
    () => sumCampaignSpend(inDateRange),
    [inDateRange],
  );
  const periodTotalFiltered = useMemo(
    () => sumCampaignSpend(chartRows),
    [chartRows],
  );

  const max = Math.max(...series.map((p) => p.spend), 0);
  const peak = max > 0 ? max : 1;
  const hasAny = series.some((p) => p.spend > 0);
  const mobileSeries = series.slice(-7);

  const chartTitle =
    selectedCampaign === ALL_CAMPAIGNS
      ? selectedBm === ALL_BMS
        ? "Total todas las BM"
        : `Total ${selectedBm}`
      : selectedCampaign;

  function handleRangeChange(start: string, end: string) {
    setStartDate(start);
    setEndDate(end);
  }

  function handleBmChange(value: string) {
    setSelectedBm(value);
    setSelectedCampaign(ALL_CAMPAIGNS);
  }

  return (
    <CrmPanel
      title="Gasto por campaña"
      subtitle="Todas las BM del cliente · elegí BM y campaña"
      className="shadow-none"
      action={
        <div className="flex flex-col items-end gap-0.5 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
            Total período
          </p>
          <p className="text-[15px] font-bold tabular-nums text-[var(--auth-text)]">
            {moneyUsd(periodTotalAll)}
          </p>
          {periodTotalFiltered !== periodTotalAll ? (
            <p className="text-[11px] font-medium tabular-nums text-[var(--auth-text-muted)]">
              Filtro activo: {moneyUsd(periodTotalFiltered)}
            </p>
          ) : null}
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5 sm:py-10">
          Aún no hay gasto por campaña. Cuando Hecom sincronice snapshots de
          TikTok (o haya filas de gasto con nombre de campaña), vas a poder
          filtrar por BM 10, 30, 200 y por nombre de campaña.
        </p>
      ) : (
        <>
          <div className="space-y-3 border-b border-[var(--auth-divider)] px-4 py-3 sm:px-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Business Manager
                </span>
                <select
                  value={selectedBm}
                  onChange={(e) => handleBmChange(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--auth-divider)] bg-white px-3 text-[13px] font-medium text-[var(--auth-text)] outline-none focus:border-[var(--auth-accent)]"
                >
                  <option value={ALL_BMS}>Todas las BM</option>
                  {bms.map((bm) => (
                    <option key={bm} value={bm}>
                      {bm}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block sm:col-span-1 lg:col-span-1">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Campaña
                </span>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="h-10 w-full rounded-xl border border-[var(--auth-divider)] bg-white px-3 text-[13px] font-medium text-[var(--auth-text)] outline-none focus:border-[var(--auth-accent)]"
                >
                  <option value={ALL_CAMPAIGNS}>
                    Todas las campañas ({moneyUsd(sumCampaignSpend(bmFiltered))})
                  </option>
                  {campaigns.map((c) => (
                    <option key={c.campaignName} value={c.campaignName}>
                      {c.campaignName} · {moneyUsd(c.total)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-2 lg:col-span-1">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Rango de fechas
                </p>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={handleRangeChange}
                  minDate={bounds.min}
                  maxDate={bounds.max ?? todayYmdInTz()}
                  className="w-full max-w-full"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-[var(--auth-divider)] px-4 py-2.5 sm:px-5">
            <p className="text-[12px] font-semibold text-[var(--auth-text)]">
              {chartTitle}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--auth-text-muted)]">
              {series.length} día{series.length === 1 ? "" : "s"} con gasto ·{" "}
              {moneyUsd(periodTotalFiltered)} en el rango
            </p>
          </div>

          {!hasAny ? (
            <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5 sm:py-10">
              No hay gasto en este rango con los filtros elegidos. Probá otra BM,
              campaña o ampliá las fechas.
            </p>
          ) : (
            <>
              <div className="px-3 pb-4 pt-4 sm:hidden">
                <div className="flex h-36 items-end gap-2">
                  {mobileSeries.map((point) => {
                    const barPx =
                      point.spend > 0
                        ? Math.max(10, Math.round((point.spend / peak) * 108))
                        : 4;
                    return (
                      <div
                        key={point.date}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                        title={`${shortDayLabel(point.date)}: ${moneyUsd(point.spend)}`}
                      >
                        <span className="max-w-full truncate text-[9px] font-semibold tabular-nums text-[var(--auth-text-soft)]">
                          {point.spend > 0
                            ? moneyUsd(point.spend).replace(/^\$/, "")
                            : "\u00a0"}
                        </span>
                        <div
                          className="w-full max-w-[2.5rem] rounded-t-md bg-[var(--auth-accent)]/70"
                          style={{ height: barPx }}
                        />
                        <span className="text-[9px] font-semibold tabular-nums text-[var(--auth-text-soft)]">
                          {shortDayLabel(point.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hidden px-4 pb-4 pt-5 sm:block sm:px-5">
                <div className="flex h-40 items-end gap-1.5 sm:gap-2">
                  {series.map((point) => {
                    const barPx =
                      point.spend > 0
                        ? Math.max(8, Math.round((point.spend / peak) * 112))
                        : 4;
                    return (
                      <div
                        key={point.date}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                        title={`${shortDayLabel(point.date)}: ${moneyUsd(point.spend)}`}
                      >
                        <span className="max-w-full truncate text-[9px] font-semibold tabular-nums text-[var(--auth-text-soft)] sm:text-[10px]">
                          {point.spend > 0
                            ? moneyUsd(point.spend).replace(/^\$/, "")
                            : "\u00a0"}
                        </span>
                        <div
                          className="w-full max-w-[2.25rem] rounded-t-md bg-[var(--auth-accent)]/65"
                          style={{ height: barPx }}
                        />
                        <span className="text-[9px] font-semibold tabular-nums text-[var(--auth-text-soft)] sm:text-[10px]">
                          {shortDayLabel(point.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </CrmPanel>
  );
}
