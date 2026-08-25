"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DateRangePicker } from "@/components/dashboard/DateRangePicker.client";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { formatBmBucketLabel } from "@/lib/hecom/bm-bucket.shared";
import {
  buildDailySeriesFromCampaignRows,
  filterCampaignSpendRows,
  getCampaignSpendDateBounds,
  listCampaignsByRecent,
  listCampaignsBySpend,
  listUniqueBms,
  mergeBmLabels,
  sumCampaignSpend,
  type CampaignSpendSummary,
  type HecomCampaignSpendRow,
} from "@/lib/hecom/campaign-spend";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { moneyUsd } from "@/lib/format/money-usd";
import type { HecomTiktokAccount } from "@/lib/hecom/clientes.server";

const ALL_BMS = "__all_bms__";
const ALL_CAMPAIGNS = "__all_campaigns__";

type CampaignSortMode = "recent" | "spend" | "az";
type ChartWindow = "14" | "30" | "all";

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

function compactUsd(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  if (value >= 100) return value.toFixed(0);
  return value.toFixed(value < 10 ? 2 : 1);
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function CampaignSpendExplorer({
  rows,
  accounts = [],
}: {
  rows: HecomCampaignSpendRow[];
  accounts?: HecomTiktokAccount[];
}) {
  const bounds = useMemo(() => getCampaignSpendDateBounds(rows), [rows]);
  const initialRange = useMemo(() => defaultRange(bounds), [bounds]);

  const accountBmLabels = useMemo(
    () => accounts.map((a) => formatBmBucketLabel(a.bmBucket)),
    [accounts],
  );

  const bms = useMemo(
    () => mergeBmLabels(listUniqueBms(rows), accountBmLabels),
    [rows, accountBmLabels],
  );

  const advertisersByBm = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const account of accounts) {
      const label = formatBmBucketLabel(account.bmBucket);
      if (!label) continue;
      const set = map.get(label) ?? new Set<string>();
      set.add(account.advertiserId);
      map.set(label, set);
    }
    return map;
  }, [accounts]);

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedBm, setSelectedBm] = useState(ALL_BMS);
  const [selectedCampaign, setSelectedCampaign] = useState(ALL_CAMPAIGNS);
  const [campaignSort, setCampaignSort] = useState<CampaignSortMode>("recent");
  const [chartWindow, setChartWindow] = useState<ChartWindow>("30");

  const calendarMax = todayYmdInTz();

  // Si llega un jale más nuevo (ej. hasta el 23), abrir el rango automáticamente.
  useEffect(() => {
    if (!bounds.max) return;
    setEndDate((prev) => (bounds.max! > prev ? bounds.max! : prev));
  }, [bounds.max]);

  const inDateRange = useMemo(
    () =>
      filterCampaignSpendRows(rows, {
        startDate,
        endDate,
      }),
    [rows, startDate, endDate],
  );

  const bmAdvertisers =
    selectedBm === ALL_BMS ? null : (advertisersByBm.get(selectedBm) ?? null);

  const bmFiltered = useMemo(
    () =>
      filterCampaignSpendRows(inDateRange, {
        bm: selectedBm === ALL_BMS ? null : selectedBm,
        advertiserIdsForBm: bmAdvertisers,
      }),
    [inDateRange, selectedBm, bmAdvertisers],
  );

  const campaigns = useMemo(() => {
    const base = listCampaignsBySpend(bmFiltered);
    if (campaignSort === "recent") return listCampaignsByRecent(bmFiltered);
    if (campaignSort === "az") {
      return [...base].sort((a, b) =>
        a.campaignName.localeCompare(b.campaignName, "es"),
      );
    }
    return base;
  }, [bmFiltered, campaignSort]);

  const recentCampaigns = useMemo(
    () => listCampaignsByRecent(bmFiltered).slice(0, 6),
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

  const seriesFull = useMemo(
    () => buildDailySeriesFromCampaignRows(chartRows),
    [chartRows],
  );

  const series = useMemo(() => {
    if (chartWindow === "all") return seriesFull;
    const n = chartWindow === "14" ? 14 : 30;
    return seriesFull.slice(-n);
  }, [seriesFull, chartWindow]);

  const periodTotalAll = useMemo(
    () => sumCampaignSpend(inDateRange),
    [inDateRange],
  );
  const periodTotalFiltered = useMemo(
    () => sumCampaignSpend(chartRows),
    [chartRows],
  );
  const bmTotals = useMemo(() => {
    return bms.map((bm) => {
      const advertisers = advertisersByBm.get(bm) ?? null;
      const total = sumCampaignSpend(
        filterCampaignSpendRows(inDateRange, {
          bm,
          advertiserIdsForBm: advertisers,
        }),
      );
      return { bm, total };
    });
  }, [bms, inDateRange, advertisersByBm]);

  const max = Math.max(...series.map((p) => p.spend), 0);
  const peak = max > 0 ? max : 1;
  const hasAny = series.some((p) => p.spend > 0);
  const labelStep = series.length > 20 ? 4 : series.length > 12 ? 2 : 1;

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
      subtitle="Filtrá por BM y campaña · buscá o elegí recientes"
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
              Vista: {moneyUsd(periodTotalFiltered)}
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
            {bms.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <BmChip
                  active={selectedBm === ALL_BMS}
                  onClick={() => handleBmChange(ALL_BMS)}
                  label="Todas"
                  total={periodTotalAll}
                />
                {bmTotals.map(({ bm, total }) => (
                  <BmChip
                    key={bm}
                    active={selectedBm === bm}
                    onClick={() => handleBmChange(bm)}
                    label={bm}
                    total={total}
                  />
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
              <CampaignSearchPicker
                campaigns={campaigns}
                recent={recentCampaigns}
                selected={selectedCampaign}
                allTotal={sumCampaignSpend(bmFiltered)}
                sortMode={campaignSort}
                onSortModeChange={setCampaignSort}
                onChange={setSelectedCampaign}
              />

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Rango de fechas
                </p>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={handleRangeChange}
                  minDate={bounds.min}
                  maxDate={calendarMax}
                  className="w-full max-w-full"
                />
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Gráfico
                </p>
                <div className="flex h-10 overflow-hidden rounded-xl border border-[var(--auth-divider)] bg-white">
                  {(
                    [
                      ["14", "14d"],
                      ["30", "30d"],
                      ["all", "Todo"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChartWindow(value)}
                      className={`min-w-0 flex-1 px-2.5 text-[12px] font-semibold transition-colors ${
                        chartWindow === value
                          ? "bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]"
                          : "text-[var(--auth-text-muted)] hover:bg-[var(--auth-bg)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--auth-divider)] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold tracking-tight text-[var(--auth-text)]">
                {chartTitle}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--auth-text-muted)]">
                {series.length} día{series.length === 1 ? "" : "s"} en vista ·{" "}
                {moneyUsd(periodTotalFiltered)} en el rango
                {seriesFull.length > series.length
                  ? ` · mostrando últimos ${series.length}`
                  : ""}
              </p>
            </div>
            <p className="text-[18px] font-bold tabular-nums text-[var(--auth-accent)]">
              {moneyUsd(
                Math.round(
                  series.reduce((acc, p) => acc + p.spend, 0) * 100,
                ) / 100,
              )}
            </p>
          </div>

          {!hasAny ? (
            <p className="px-4 py-8 text-[13px] font-medium text-[var(--auth-text-muted)] sm:px-5 sm:py-10">
              No hay gasto en este rango con los filtros elegidos. Probá otra BM,
              campaña o ampliá las fechas.
            </p>
          ) : (
            <div className="px-3 pb-4 pt-3 sm:px-5 sm:pt-4">
              <div className="relative h-44 sm:h-48">
                <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
                  {series.map((point, index) => {
                    const barPx =
                      point.spend > 0
                        ? Math.max(6, Math.round((point.spend / peak) * 132))
                        : 3;
                    const showLabel =
                      index === 0 ||
                      index === series.length - 1 ||
                      index % labelStep === 0;
                    const isPeak = point.spend === max && point.spend > 0;
                    return (
                      <div
                        key={point.date}
                        className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                        title={`${shortDayLabel(point.date)}: ${moneyUsd(point.spend)}`}
                      >
                        <div className="pointer-events-none absolute bottom-[calc(100%-1.5rem)] z-10 hidden -translate-y-1 rounded-md bg-[var(--auth-text)] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100">
                          {shortDayLabel(point.date)} · {moneyUsd(point.spend)}
                        </div>
                        {(isPeak || series.length <= 10) && point.spend > 0 ? (
                          <span className="mb-1 max-w-full truncate text-[9px] font-semibold tabular-nums text-[var(--auth-text-soft)] sm:text-[10px]">
                            {compactUsd(point.spend)}
                          </span>
                        ) : (
                          <span className="mb-1 h-[12px]" aria-hidden />
                        )}
                        <div
                          className={`w-full max-w-[2rem] rounded-t-md transition-[height,background-color] ${
                            isPeak
                              ? "bg-[var(--auth-accent)]"
                              : "bg-[var(--auth-accent)]/55 group-hover:bg-[var(--auth-accent)]/85"
                          }`}
                          style={{ height: barPx }}
                        />
                        <span
                          className={`mt-1.5 h-4 text-[9px] font-semibold tabular-nums sm:text-[10px] ${
                            showLabel
                              ? "text-[var(--auth-text-soft)]"
                              : "text-transparent"
                          }`}
                        >
                          {showLabel ? shortDayLabel(point.date) : "·"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-1 text-center text-[10px] text-[var(--auth-text-soft)]">
                Pasá el mouse sobre una barra para ver el monto exacto
              </p>
            </div>
          )}
        </>
      )}
    </CrmPanel>
  );
}

function BmChip({
  active,
  onClick,
  label,
  total,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  total: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
        active
          ? "bg-[var(--auth-accent-soft)] text-[var(--auth-accent)] ring-1 ring-[var(--auth-accent)]/35"
          : "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] hover:bg-[var(--auth-accent-soft)]/50"
      }`}
    >
      {label}
      <span className="ml-1 font-semibold tabular-nums opacity-80">
        {moneyUsd(total)}
      </span>
    </button>
  );
}

function CampaignSearchPicker({
  campaigns,
  recent,
  selected,
  allTotal,
  sortMode,
  onSortModeChange,
  onChange,
}: {
  campaigns: CampaignSpendSummary[];
  recent: CampaignSpendSummary[];
  selected: string;
  allTotal: number;
  sortMode: CampaignSortMode;
  onSortModeChange: (mode: CampaignSortMode) => void;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel =
    selected === ALL_CAMPAIGNS
      ? `Todas las campañas · ${moneyUsd(allTotal)}`
      : `${selected} · ${moneyUsd(
          campaigns.find((c) => c.campaignName === selected)?.total ?? 0,
        )}`;

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return campaigns;
    return campaigns.filter((c) =>
      normalizeSearch(c.campaignName).includes(q),
    );
  }, [campaigns, query]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  function pick(value: string) {
    onChange(value);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
        Campaña
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[var(--auth-divider)] bg-white px-3 text-left text-[13px] font-medium text-[var(--auth-text)] outline-none transition-colors hover:border-[var(--auth-accent)]/40 focus:border-[var(--auth-accent)]"
      >
        <span className="min-w-0 truncate">{selectedLabel}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--auth-text-soft)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-2xl border border-[var(--auth-divider)] bg-white shadow-[0_18px_40px_rgb(28_25_23_/_0.14)]">
          <div className="border-b border-[var(--auth-divider)] p-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-[var(--auth-bg)] px-3 py-2">
              <svg
                className="h-4 w-4 shrink-0 text-[var(--auth-text-soft)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
                />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar campaña…"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--auth-text)] outline-none placeholder:text-[var(--auth-text-soft)]"
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ModeChip
                active={sortMode === "recent"}
                onClick={() => onSortModeChange("recent")}
              >
                Recientes
              </ModeChip>
              <ModeChip
                active={sortMode === "spend"}
                onClick={() => onSortModeChange("spend")}
              >
                Mayor gasto
              </ModeChip>
              <ModeChip
                active={sortMode === "az"}
                onClick={() => onSortModeChange("az")}
              >
                A–Z
              </ModeChip>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto py-1">
            <CampaignOption
              active={selected === ALL_CAMPAIGNS}
              onClick={() => pick(ALL_CAMPAIGNS)}
              title="Todas las campañas"
              meta={moneyUsd(allTotal)}
            />

            {!query && recent.length > 0 && sortMode === "recent" ? (
              <>
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Recientes
                </p>
                {recent.map((c) => (
                  <CampaignOption
                    key={`recent-${c.campaignName}`}
                    active={selected === c.campaignName}
                    onClick={() => pick(c.campaignName)}
                    title={c.campaignName}
                    meta={moneyUsd(c.total)}
                    date={c.lastDate}
                  />
                ))}
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                  Todas ({filtered.length})
                </p>
              </>
            ) : (
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                {query
                  ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`
                  : `Campañas (${filtered.length})`}
              </p>
            )}

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-[var(--auth-text-muted)]">
                No hay campañas con ese nombre.
              </p>
            ) : (
              filtered.map((c) => (
                <CampaignOption
                  key={c.campaignName}
                  active={selected === c.campaignName}
                  onClick={() => pick(c.campaignName)}
                  title={c.campaignName}
                  meta={moneyUsd(c.total)}
                  date={sortMode === "recent" ? c.lastDate : null}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ModeChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
        active
          ? "bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]"
          : "bg-[var(--auth-bg)] text-[var(--auth-text-muted)] hover:text-[var(--auth-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function CampaignOption({
  active,
  onClick,
  title,
  meta,
  badge,
  date,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  meta: string;
  badge?: string | null;
  date?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors ${
        active
          ? "bg-[var(--auth-accent-soft)]/70"
          : "hover:bg-[var(--auth-bg)]"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-[var(--auth-text)]">
          {title}
        </span>
        {(badge || date) && (
          <span className="mt-0.5 flex flex-wrap gap-1.5">
            {badge ? (
              <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[var(--auth-text-muted)]">
                {badge}
              </span>
            ) : null}
            {date ? (
              <span className="text-[10px] tabular-nums text-[var(--auth-text-soft)]">
                Último {shortDayLabel(date)}
              </span>
            ) : null}
          </span>
        )}
      </span>
      <span className="shrink-0 pt-0.5 text-[12px] font-bold tabular-nums text-[var(--auth-text)]">
        {meta}
      </span>
    </button>
  );
}
