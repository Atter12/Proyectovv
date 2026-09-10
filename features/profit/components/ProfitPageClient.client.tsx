"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { ProfitDateRangeField } from "@/features/profit/components/ProfitDateRangeField.client";
import { formatMoney } from "@/lib/format-money";
import { moneyUsd } from "@/lib/format/money-usd";

function limaTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type StoreSummary = {
  id: string;
  name: string;
  shopDomain: string | null;
  currency: string;
  isActive?: boolean;
};

type CampaignRow = {
  campaignExternalId: string;
  campaignName: string;
  platform: string;
  spend: number;
  spendShare: number;
  collectedEstimated: number;
  roasEstimated: number | null;
  bm: string | null;
  advertiserId: string | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  costPerConversion: number | null;
  hasTikTokPerf: boolean;
  lastStatDate: string | null;
};

type DailyPoint = { date: string; spend: number };

type ProfitSignal = {
  kind: string;
  severity: "info" | "warn";
  title: string;
  detail: string;
};

type Analysis = {
  from: string;
  to: string;
  spendToday: number;
  spendYesterday: number;
  spendTodayDeltaPct: number | null;
  spend7d: number;
  spendPrev7d: number;
  spend7dDeltaPct: number | null;
  spend30d: number;
  spendInRange: number;
  spendPrevRange: number;
  spendRangeDeltaPct: number | null;
  pacingRatio: number | null;
  pacingLabel: "acelerando" | "normal" | "bajo" | "parado" | "sin_base";
  daysWithActivity: number;
  dailySeries: DailyPoint[];
  campaigns: CampaignRow[];
  collectedRevenue: number;
  roasCollected: number | null;
  hasCodLink: boolean;
  ordersCollected?: number;
  cpaCollected?: number | null;
  avgOrderCollected?: number | null;
  feePercent?: number;
  effectiveAdSpend?: number;
  roasEffective?: number | null;
  breakEvenRoas?: number;
  aboveBreakEven?: boolean | null;
  dataThroughDate: string | null;
  signals: ProfitSignal[];
  perf?: {
    available: boolean;
    impressions: number;
    clicks: number;
    conversions: number;
    avgCtr: number | null;
    avgCpc: number | null;
    avgCpm: number | null;
    advertisersQueried: number;
    advertisersOk: number;
    fetchedAt: string | null;
    error: string | null;
  };
};

type Snapshot = {
  store: StoreSummary;
  from: string;
  to: string;
  collectedRevenue: number;
  adSpend: number;
  roasCollected: number | null;
  ordersCollected: number;
  spendSource?: "realprofit" | "holistic_tiktok" | "none";
};

function formatDelta(pct: number | null): string {
  if (pct == null) return "sin base";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function pacingBadge(label: Analysis["pacingLabel"]): {
  text: string;
  className: string;
} {
  switch (label) {
    case "acelerando":
      return {
        text: "Pacing · acelerando",
        className: "bg-[#fff7f0] text-[#c2410c]",
      };
    case "bajo":
      return {
        text: "Pacing · bajo",
        className: "bg-amber-50 text-amber-900",
      };
    case "parado":
      return {
        text: "Pacing · parado",
        className: "bg-[#f3efe9] text-[#6b645c]",
      };
    case "normal":
      return {
        text: "Pacing · normal",
        className: "bg-emerald-50 text-emerald-800",
      };
    default:
      return {
        text: "Pacing · sin base",
        className: "bg-[#f3efe9] text-[#6b645c]",
      };
  }
}

function formatSyncTime(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type SortKey = "spend" | "share" | "name" | "roas" | "ctr" | "cpc";

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3.5 ${
        accent
          ? "border-[#ffd7b8] bg-[#fff7f0]"
          : "border-[#ece7e0] bg-white"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9a9187]">
        {label}
      </p>
      <p
        className={`mt-1 text-[1.25rem] font-bold tabular-nums tracking-[-0.02em] ${
          accent ? "text-[#c2410c]" : "text-[#1c1917]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-[#8a8177]">{hint}</p>
    </div>
  );
}

function formatDayShort(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
  }).format(dt);
}

function formatRangeLabel(from: string, to: string): string {
  if (!from || !to) return "—";
  if (from === to) return formatDayShort(from);
  return `${formatDayShort(from)} → ${formatDayShort(to)}`;
}

function DailyBars({
  series,
  todayYmd,
  liveTodaySpend,
}: {
  series: DailyPoint[];
  todayYmd: string;
  liveTodaySpend: number | null;
}) {
  const display = series.map((p) => {
    if (
      p.date === todayYmd &&
      liveTodaySpend != null &&
      Number.isFinite(liveTodaySpend)
    ) {
      return { ...p, spend: liveTodaySpend, live: true as const };
    }
    return { ...p, live: false as const };
  });
  const max = Math.max(...display.map((p) => p.spend), 0);
  const peak = max > 0 ? max : 1;
  const hasAny = display.some((p) => p.spend > 0);
  const total = display.reduce((s, p) => s + p.spend, 0);

  if (!hasAny) {
    return (
      <p className="px-1 py-6 text-[13px] text-[#8a8177]">
        Sin gasto diario en este período. Cuando haya snapshots TikTok o filas
        de gasto con fecha, aparecen acá.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Serie diaria
          </p>
          <p className="mt-0.5 text-[12px] text-[#5c564e]">
            {display.length} días · total {moneyUsd(total)}
            {liveTodaySpend != null ? " · hoy en vivo" : ""}
          </p>
        </div>
        <p className="text-[11px] tabular-nums text-[#9a9187]">
          Pico {moneyUsd(max)}
        </p>
      </div>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div
          className="flex h-36 items-end gap-1"
          style={{ minWidth: `${Math.max(display.length * 22, 280)}px` }}
        >
          {display.map((p) => {
            const h = Math.max(4, (p.spend / peak) * 100);
            const isToday = p.date === todayYmd;
            return (
              <div
                key={p.date}
                className="group relative flex min-w-[18px] flex-1 flex-col items-center gap-1"
                title={`${p.date}: ${moneyUsd(p.spend)}${p.live ? " · live" : ""}`}
              >
                <span className="pointer-events-none absolute -top-7 hidden rounded-md bg-[#1c1917] px-1.5 py-0.5 text-[10px] font-semibold text-white group-hover:block">
                  {moneyUsd(p.spend)}
                </span>
                <div
                  className={`w-full max-w-[18px] rounded-t-md transition ${
                    isToday
                      ? "bg-[linear-gradient(180deg,#ff9a4d_0%,#ff781f_100%)] ring-2 ring-[#ff781f]/35"
                      : "bg-[#ff781f]/75 hover:bg-[#ff781f]"
                  }`}
                  style={{ height: `${h}%` }}
                />
                <span
                  className={`text-[9px] tabular-nums ${
                    isToday
                      ? "font-bold text-[#c2410c]"
                      : "text-[#9a9187]"
                  }`}
                >
                  {p.date.slice(8)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] tabular-nums text-[#9a9187]">
        <span>{formatDayShort(display[0]!.date)}</span>
        <span>{formatDayShort(display.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

export function ProfitPageClient({
  clienteName,
  isStaff: _isStaff,
  initialFrom,
  initialTo,
}: {
  clienteName: string;
  isStaff: boolean;
  initialFrom?: string;
  initialTo?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [bmFilter, setBmFilter] = useState<string>("all");
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [subscription, setSubscription] = useState<RpSubscription | null>(null);

  function openShopifyModal() {
    setShopifyModalOpen(true);
  }

  const live = useAdAccountLiveMetrics(true);
  const liveAccounts = useMemo(() => {
    return Object.values(live.metricsByAdvertiser)
      .filter(
        (a) =>
          (a.balanceUsd != null && a.balanceUsd > 0) ||
          (a.spendTodayUsd != null && a.spendTodayUsd > 0),
      )
      .sort(
        (a, b) => (b.spendTodayUsd ?? 0) - (a.spendTodayUsd ?? 0),
      );
  }, [live.metricsByAdvertiser]);
  const liveBalanceTotal = Object.values(live.metricsByAdvertiser).reduce(
    (s, a) => s + (a.balanceUsd ?? 0),
    0,
  );
  const liveSpendTotal = Object.values(live.metricsByAdvertiser).reduce(
    (s, a) => s + (a.spendTodayUsd ?? 0),
    0,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q =
        from && to
          ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
          : "";
      const res = await fetch(`/api/profit${q}`, { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        from?: string;
        to?: string;
        snapshots?: Snapshot[];
        analysis?: Analysis;
        subscription?: RpSubscription | null;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo cargar Profit.");
      }
      setAnalysis(json.analysis ?? null);
      setSnapshots(
        (json.snapshots ?? []).filter((s) => s.store.id !== "__holistic_tiktok__"),
      );
      setSubscription(json.subscription ?? null);
      if (!from && json.from) setFrom(json.from);
      if (!to && json.to) setTo(json.to);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (from && to && from > to) {
      setError("La fecha Desde no puede ser después de Hasta.");
      return;
    }
    const delay = from && to ? 280 : 0;
    const timer = window.setTimeout(() => {
      void refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [from, to, refresh]);

  const bmOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of analysis?.campaigns ?? []) {
      if (c.bm?.trim()) set.add(c.bm.trim());
    }
    return [...set].sort();
  }, [analysis]);

  const sortedCampaigns = useMemo(() => {
    let rows = analysis?.campaigns ?? [];
    if (bmFilter !== "all") {
      rows = rows.filter((c) => (c.bm ?? "") === bmFilter);
    }
    const mul = sortAsc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "name") {
        return mul * a.campaignName.localeCompare(b.campaignName);
      }
      if (sortKey === "share") return mul * (a.spendShare - b.spendShare);
      if (sortKey === "roas") {
        const ar = a.roasEstimated ?? -1;
        const br = b.roasEstimated ?? -1;
        return mul * (ar - br);
      }
      if (sortKey === "ctr") {
        const ar = a.ctr ?? -1;
        const br = b.ctr ?? -1;
        return mul * (ar - br);
      }
      if (sortKey === "cpc") {
        const ar = a.cpc ?? Number.POSITIVE_INFINITY;
        const br = b.cpc ?? Number.POSITIVE_INFINITY;
        return mul * (ar - br);
      }
      return mul * (a.spend - b.spend);
    });
  }, [analysis, bmFilter, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  const useLiveForToday = Boolean(live.lastUpdatedAt) && !live.error;
  const spendTodayDisplay = useLiveForToday
    ? liveSpendTotal
    : (analysis?.spendToday ?? 0);
  const syncLabel = formatSyncTime(live.lastUpdatedAt);
  const todayYmd = limaTodayYmd();
  const hoyHint = useLiveForToday
    ? `TikTok en vivo · America/Lima${
        liveBalanceTotal > 0 ? ` · saldo ${moneyUsd(liveBalanceTotal)}` : ""
      }${syncLabel ? ` · act. ${syncLabel}` : ""}`
    : analysis
      ? `Snapshots · vs ayer ${formatDelta(analysis.spendTodayDeltaPct)}`
      : "Cargando live…";

  const displayPacing = useMemo(() => {
    if (!analysis) {
      return { pacingRatio: null as number | null, pacingLabel: "sin_base" as const };
    }
    const spendToday = useLiveForToday ? liveSpendTotal : analysis.spendToday;
    const spend7d = analysis.spend7d;
    if (spendToday <= 0 && spend7d <= 0) {
      return { pacingRatio: null, pacingLabel: "sin_base" as const };
    }
    if (spendToday <= 0) {
      return { pacingRatio: 0, pacingLabel: "parado" as const };
    }
    const avg = spend7d / 7;
    if (avg <= 0) {
      return { pacingRatio: null, pacingLabel: "sin_base" as const };
    }
    const ratio = Math.round((spendToday / avg) * 100) / 100;
    if (ratio >= 1.35) return { pacingRatio: ratio, pacingLabel: "acelerando" as const };
    if (ratio <= 0.5) return { pacingRatio: ratio, pacingLabel: "bajo" as const };
    return { pacingRatio: ratio, pacingLabel: "normal" as const };
  }, [analysis, useLiveForToday, liveSpendTotal]);

  const visibleSignals = useMemo(() => {
    const list = analysis?.signals ?? [];
    if (spendTodayDisplay > 0) {
      return list.filter(
        (s) => s.kind !== "silent" && !(s.kind === "pacing" && s.title.includes("parado")),
      );
    }
    return list;
  }, [analysis?.signals, spendTodayDisplay]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-[#ece7e0] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_45%,#f7f4ef_100%)] px-5 py-6 sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff781f]/[0.12] blur-3xl"
        />
        <div className="relative">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#ff781f]">
            Análisis de campañas
          </p>
          <h1 className="mt-1.5 text-[1.55rem] font-bold tracking-[-0.035em] text-[#1c1917] sm:text-[1.75rem]">
            Profit · {clienteName}
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#5c564e]">
            Gasto TikTok, ranking de campañas, CTR/CPC, pacing y señales —
            incluido en Holistic.
          </p>
        </div>
      </header>

      {error ? (
        <div
          className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-[#ffd7b8] bg-[linear-gradient(160deg,#fffaf6_0%,#ffffff_55%,#fff7f0_100%)] p-5 shadow-[0_14px_36px_-24px_rgb(255_120_31_/_0.55)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
              Consumo TikTok · hoy
            </p>
            <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]">
              Gasto live · solo hoy
            </h2>
            <p className="mt-0.5 text-[12px] text-[#8a8177]">{hoyHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pacingBadge(displayPacing.pacingLabel).className}`}
            >
              {pacingBadge(displayPacing.pacingLabel).text}
              {displayPacing.pacingRatio != null
                ? ` · ${displayPacing.pacingRatio.toFixed(2)}×`
                : ""}
            </span>
            <button
              type="button"
              onClick={() => void live.refresh({ force: true })}
              disabled={live.loading}
              className="rounded-full border border-[#ffd7b8] bg-white px-3 py-1.5 text-[11px] font-bold text-[#c2410c] transition hover:bg-[#fff7f0] disabled:opacity-55"
            >
              {live.loading ? "Actualizando…" : "Actualizar live"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[#ffd7b8]/80 bg-white px-5 py-5 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a9187]">
            Hoy · {formatDayShort(todayYmd)} · en vivo
          </p>
          <p
            className={`mt-1 text-[2.35rem] font-bold tabular-nums tracking-[-0.04em] sm:text-[2.75rem] ${
              spendTodayDisplay > 0 ? "text-[#c2410c]" : "text-[#1c1917]"
            }`}
          >
            {live.loading && !live.lastUpdatedAt
              ? "…"
              : moneyUsd(spendTodayDisplay)}
          </p>
          {syncLabel ? (
            <p className="mt-1 text-[12px] text-[#8a8177]">
              Última sync {syncLabel} · se refresca cada {live.pollSeconds}s
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-[#8a8177]">
              Consultando TikTok report de hoy…
            </p>
          )}
        </div>

        {liveAccounts.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {liveAccounts.slice(0, 6).map((acc) => (
              <li
                key={acc.advertiserId}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#f0ebe4] bg-white/80 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[#1c1917]">
                    {acc.accountName}
                  </p>
                  <p className="truncate text-[11px] tabular-nums text-[#9a9187]">
                    {acc.bmBucket ? `BM ${acc.bmBucket} · ` : ""}
                    {acc.advertiserId}
                  </p>
                </div>
                <p className="shrink-0 text-[14px] font-bold tabular-nums text-[#c2410c]">
                  {moneyUsd(acc.spendTodayUsd ?? 0)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}

        {live.error ? (
          <p className="text-[12px] font-medium text-amber-800" role="alert">
            Live: {live.error}
            {analysis
              ? ` · mostrando snapshots (${moneyUsd(analysis.spendToday)})`
              : ""}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#ece7e0] bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-xl border border-[#f0ebe4] bg-[#faf8f5] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
            <div className="min-w-0 max-w-xl">
              <p className="text-[13px] font-semibold tracking-[-0.01em] text-[#1c1917]">
                Conectar Shopify
              </p>
              <p className="mt-1 text-[12.5px] leading-5 text-[#5c564e]">
                Vinculá tu tienda para jalar pedidos y ventas reales (COD). Así
                Profit cruza el gasto TikTok con lo cobrado y el ROAS deja de
                ser solo estimado.
              </p>
            </div>
            <button
              type="button"
              onClick={openShopifyModal}
              className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[var(--auth-accent)] px-5 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] sm:w-auto"
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8h12l-1 12H7L6 8Z" />
                <path d="M9 8V7a3 3 0 0 1 6 0v1" />
              </svg>
              Conectar
            </button>
          </div>

          <div>
            <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              Rango de calendario
            </p>
            <p className="mb-3 max-w-xl text-[12.5px] leading-5 text-[#5c564e]">
              Filtra la serie diaria y el ranking de campañas. El gasto live de
              arriba siempre es solo hoy.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <ProfitDateRangeField
                from={from}
                to={to}
                max={limaTodayYmd()}
                onChange={({ from: nextFrom, to: nextTo }) => {
                  setFrom(nextFrom);
                  setTo(nextTo);
                }}
              />
              {loading ? (
                <p className="pb-3 text-[11px] font-semibold text-[#c2410c]">
                  Cargando…
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {loading && !analysis ? (
        <p className="text-[13px] text-[#8a8177]">Cargando análisis…</p>
      ) : analysis ? (
        <>
          <section className="space-y-4 rounded-2xl border border-[#ece7e0] bg-white p-5 shadow-[0_10px_28px_-22px_rgb(28_25_23_/_0.35)] sm:p-6">
            <div className="rounded-xl border border-[#f0ebe4] bg-[#faf8f5] px-4 py-4">
              <DailyBars
                series={analysis.dailySeries}
                todayYmd={todayYmd}
                liveTodaySpend={useLiveForToday ? liveSpendTotal : null}
              />
            </div>

            {analysis.from || analysis.to ? (
              <p className="text-[12px] text-[#8a8177]">
                Serie del rango {formatRangeLabel(analysis.from, analysis.to)}
                {analysis.daysWithActivity
                  ? ` · ${analysis.daysWithActivity} días con actividad`
                  : ""}
                {analysis.dataThroughDate
                  ? ` · datos hasta ${formatDayShort(analysis.dataThroughDate)}`
                  : ""}
                {" · en el rango "}
                <span className="font-semibold text-[#1c1917]">
                  {moneyUsd(analysis.spendInRange)}
                </span>
              </p>
            ) : null}

            {visibleSignals.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                  Señales
                </p>
                {visibleSignals.map((sig, i) => (
                  <div
                    key={`${sig.kind}-${i}`}
                    className={`rounded-xl border px-4 py-3 text-[13px] ${
                      sig.severity === "warn"
                        ? "border-[#ffd7b8] bg-[#fff7f0] text-[#9a3412]"
                        : "border-[#ece7e0] bg-[#faf8f5] text-[#5c564e]"
                    }`}
                  >
                    <p className="font-semibold text-[#1c1917]">{sig.title}</p>
                    <p className="mt-0.5 text-[12px]">{sig.detail}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-[#ece7e0] bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                  Campañas
                </p>
                <h2 className="mt-1 text-[1.1rem] font-bold text-[#1c1917]">
                  Ranking + performance TikTok
                </h2>
                <p className="mt-0.5 text-[12px] text-[#5c564e]">
                  Rango {formatRangeLabel(analysis.from, analysis.to)}
                  {analysis.perf?.fetchedAt
                    ? ` · perf act. ${formatSyncTime(analysis.perf.fetchedAt)}`
                    : ""}
                  . Impresiones / CTR / CPC desde report TikTok.
                </p>
              </div>
              {bmOptions.length > 0 ? (
                <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a8177]">
                  BM
                  <select
                    className="mt-1 block min-w-[140px] rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2 text-[13px] font-medium text-[#1c1917]"
                    value={bmFilter}
                    onChange={(e) => setBmFilter(e.target.value)}
                  >
                    <option value="all">Todas</option>
                    {bmOptions.map((bm) => (
                      <option key={bm} value={bm}>
                        {bm}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {analysis.perf ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                  label="Impresiones"
                  value={
                    analysis.perf.available
                      ? analysis.perf.impressions.toLocaleString("en-US")
                      : "—"
                  }
                  hint={
                    analysis.perf.error
                      ? analysis.perf.error
                      : `${analysis.perf.advertisersOk}/${analysis.perf.advertisersQueried} cuentas OK`
                  }
                />
                <Kpi
                  label="Clicks"
                  value={
                    analysis.perf.available
                      ? analysis.perf.clicks.toLocaleString("en-US")
                      : "—"
                  }
                  hint={
                    analysis.perf.conversions > 0
                      ? `${analysis.perf.conversions.toLocaleString("en-US")} conv.`
                      : "Report TikTok"
                  }
                />
                <Kpi
                  label="CTR medio"
                  value={
                    analysis.perf.avgCtr != null
                      ? `${analysis.perf.avgCtr.toFixed(2)}%`
                      : "—"
                  }
                  hint="Clicks ÷ impresiones"
                />
                <Kpi
                  label="CPC medio"
                  value={
                    analysis.perf.avgCpc != null
                      ? moneyUsd(analysis.perf.avgCpc)
                      : "—"
                  }
                  hint={
                    analysis.perf.avgCpm != null
                      ? `CPM ${moneyUsd(analysis.perf.avgCpm)}`
                      : "Gasto ÷ clicks"
                  }
                  accent
                />
              </div>
            ) : null}

            {analysis.hasCodLink ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi
                  label="Cobrado COD"
                  value={formatMoney(analysis.collectedRevenue, "PEN")}
                  hint={`${analysis.ordersCollected ?? 0} órdenes collected`}
                />
                <Kpi
                  label="CPA cobrado"
                  value={
                    analysis.cpaCollected != null
                      ? moneyUsd(analysis.cpaCollected)
                      : "—"
                  }
                  hint="Gasto ÷ órdenes collected"
                />
                <Kpi
                  label="ROAS cobrado"
                  value={
                    analysis.roasCollected != null
                      ? `${analysis.roasCollected.toFixed(2)}x`
                      : "—"
                  }
                  hint="Cobrado ÷ gasto Holistic"
                  accent
                />
                <Kpi
                  label="ROAS efectivo"
                  value={
                    analysis.roasEffective != null
                      ? `${analysis.roasEffective.toFixed(2)}x`
                      : "—"
                  }
                  hint={
                    analysis.aboveBreakEven == null
                      ? `BE ${analysis.breakEvenRoas?.toFixed(2) ?? "—"}x · fee ${analysis.feePercent ?? "—"}%`
                      : analysis.aboveBreakEven
                        ? `Sobre BE ${analysis.breakEvenRoas?.toFixed(2)}x · fee ${analysis.feePercent}%`
                        : `Bajo BE ${analysis.breakEvenRoas?.toFixed(2)}x · fee ${analysis.feePercent}%`
                  }
                />
              </div>
            ) : analysis.feePercent != null ? (
              <div className="rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-4 py-3 text-[12px] text-[#5c564e]">
                Fee Holistic {analysis.feePercent}% · coste efectivo del rango{" "}
                <span className="font-semibold text-[#1c1917]">
                  {moneyUsd(analysis.effectiveAdSpend ?? analysis.spendInRange)}
                </span>{" "}
                · BE ROAS (solo ads+fee){" "}
                <span className="font-semibold text-[#1c1917]">
                  {analysis.breakEvenRoas?.toFixed(2)}x
                </span>
                . Conectá tu tienda abajo para CPA / ganancia neta.
              </div>
            ) : null}

            {sortedCampaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-8 text-center">
                <p className="text-[13px] font-semibold text-[#1c1917]">
                  Sin campañas con gasto en este período
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-[#5c564e]">
                  Probá otro rango o esperá a que sync TikTok escriba snapshots.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#ece7e0]">
                <table className="min-w-[960px] w-full border-collapse text-left text-[11.5px]">
                  <thead className="sticky top-0 z-[1] bg-[#f7f4ef] text-[10px] uppercase tracking-[0.07em] text-[#9a9187]">
                    <tr>
                      <th className="sticky left-0 z-[2] bg-[#f7f4ef] px-3 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.07em]"
                          onClick={() => toggleSort("name")}
                        >
                          Campaña
                        </button>
                      </th>
                      <th className="whitespace-nowrap px-2.5 py-2.5 font-bold">
                        Entrega
                      </th>
                      <th className="px-2.5 py-2.5 font-bold">BM</th>
                      <th className="px-2.5 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.07em]"
                          onClick={() => toggleSort("spend")}
                        >
                          Gasto
                        </button>
                      </th>
                      <th className="px-2.5 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.07em]"
                          onClick={() => toggleSort("share")}
                        >
                          %
                        </button>
                      </th>
                      <th className="px-2.5 py-2.5 font-bold">Imp.</th>
                      <th className="px-2.5 py-2.5 font-bold">Clicks</th>
                      <th className="px-2.5 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.07em]"
                          onClick={() => toggleSort("ctr")}
                        >
                          CTR
                        </button>
                      </th>
                      <th className="px-2.5 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.07em]"
                          onClick={() => toggleSort("cpc")}
                        >
                          CPC
                        </button>
                      </th>
                      <th className="px-2.5 py-2.5 font-bold">CPM</th>
                      <th className="px-2.5 py-2.5 font-bold">Conv.</th>
                      <th className="px-2.5 py-2.5 font-bold">CPA</th>
                      {analysis.hasCodLink ? (
                        <>
                          <th className="px-2.5 py-2.5 font-bold">Cobrado est.</th>
                          <th className="px-2.5 py-2.5">
                            <button
                              type="button"
                              className="font-bold uppercase tracking-[0.07em]"
                              onClick={() => toggleSort("roas")}
                            >
                              ROAS est.
                            </button>
                          </th>
                        </>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCampaigns.map((c) => {
                      const idShown = c.campaignExternalId.startsWith("name:")
                        ? null
                        : c.campaignExternalId;
                      const deliveryDate = c.lastStatDate
                        ? formatDayShort(c.lastStatDate)
                        : formatRangeLabel(analysis.from, analysis.to);
                      const deliveryTime = c.hasTikTokPerf
                        ? formatSyncTime(analysis.perf?.fetchedAt ?? null)
                        : null;
                      return (
                        <tr
                          key={`${c.platform}-${c.campaignExternalId}-${c.advertiserId ?? ""}`}
                          className="border-t border-[#f0ebe4] hover:bg-[#fffaf6]"
                        >
                          <td className="sticky left-0 z-[1] max-w-[240px] bg-white px-3 py-2.5 hover:bg-[#fffaf6]">
                            <p className="truncate font-semibold text-[#1c1917]">
                              {c.campaignName}
                            </p>
                            <p className="mt-0.5 truncate font-mono text-[10px] tabular-nums text-[#9a9187]">
                              {idShown ?? "sin id"}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-[#b0a89e]">
                              {c.hasTikTokPerf ? "perf TikTok" : "solo Holistic"}
                              {c.advertiserId ? ` · ${c.advertiserId}` : ""}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2.5 align-top">
                            <p className="font-semibold tabular-nums text-[#1c1917]">
                              {deliveryDate}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#9a9187]">
                              {c.lastStatDate
                                ? c.lastStatDate
                                : `${analysis.from}→${analysis.to}`}
                            </p>
                            {deliveryTime ? (
                              <p className="mt-0.5 text-[10px] font-medium text-[#c2410c]">
                                act. {deliveryTime}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums text-[#6b645c]">
                            {c.bm ?? "—"}
                          </td>
                          <td className="px-2.5 py-2.5 font-semibold tabular-nums text-[#1c1917]">
                            {moneyUsd(c.spend)}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums text-[#6b645c]">
                            {(c.spendShare * 100).toFixed(1)}%
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums">
                            {c.impressions != null
                              ? c.impressions.toLocaleString("en-US")
                              : "—"}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums">
                            {c.clicks != null
                              ? c.clicks.toLocaleString("en-US")
                              : "—"}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums">
                            {c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums">
                            {c.cpc != null ? moneyUsd(c.cpc) : "—"}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums">
                            {c.cpm != null ? moneyUsd(c.cpm) : "—"}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums">
                            {c.conversions != null
                              ? c.conversions.toLocaleString("en-US")
                              : "—"}
                          </td>
                          <td className="px-2.5 py-2.5 tabular-nums">
                            {c.costPerConversion != null
                              ? moneyUsd(c.costPerConversion)
                              : "—"}
                          </td>
                          {analysis.hasCodLink ? (
                            <>
                              <td className="px-2.5 py-2.5 tabular-nums">
                                {formatMoney(c.collectedEstimated, "PEN")}
                              </td>
                              <td className="px-2.5 py-2.5 font-semibold tabular-nums text-[#c2410c]">
                                {c.roasEstimated != null
                                  ? `${c.roasEstimated.toFixed(2)}x`
                                  : "—"}
                              </td>
                            </>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section
        id="profit-shopify-connect"
        className="scroll-mt-6 overflow-hidden rounded-2xl border border-[#ece7e0] bg-white"
      >
        <div className="border-b border-[#f0ebe4] px-5 py-5 sm:px-7 sm:py-6">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Pedidos y ventas
          </p>
          <h2 className="mt-1.5 max-w-lg text-[1.2rem] font-bold tracking-[-0.03em] text-[#1c1917] sm:text-[1.35rem]">
            Conectá tu tienda Shopify
          </h2>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#5c564e]">
            Jalá pedidos y ventas reales para ver cuánto estás ganando neto —
            no solo cuánto gastás en ads.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-end sm:px-7">
          <label className="block min-w-0 flex-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
            Dominio de tu tienda
            <div className="mt-1.5 flex overflow-hidden rounded-xl border border-[#e7e0d8] bg-[#faf8f5] transition focus-within:border-[#cfc6bb] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1c1917]/8">
              <span className="flex items-center border-r border-[#e7e0d8] bg-[#f3efe9] px-3 text-[12px] font-medium normal-case tracking-normal text-[#8a8177]">
                https://
              </span>
              <input
                type="text"
                inputMode="url"
                autoComplete="off"
                placeholder="mitienda.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    openShopifyModal();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[13px] font-medium normal-case tracking-normal text-[#1c1917] outline-none placeholder:text-[#b0a89e]"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={openShopifyModal}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#1c1917] px-6 text-[13px] font-semibold text-white transition hover:bg-[#3a342e]"
          >
            Conectar
          </button>
        </div>
      </section>

      {snapshots.length > 0 ? (
        <section className="space-y-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Cobrado COD activo
          </p>
          {snapshots.map((snap) => (
            <div
              key={snap.store.id}
              className="grid grid-cols-2 gap-3 rounded-2xl border border-[#ece7e0] bg-white p-4 sm:grid-cols-4"
            >
              <div className="col-span-2 sm:col-span-4">
                <p className="text-[14px] font-bold text-[#1c1917]">
                  {snap.store.name}
                </p>
                <p className="text-[11px] text-[#8a8177]">
                  Pedidos sincronizados · cobrado del período
                </p>
              </div>
              <Kpi
                label="Cobrado"
                value={formatMoney(snap.collectedRevenue, snap.store.currency)}
                hint={`${snap.ordersCollected} órdenes`}
              />
              <Kpi
                label="Gasto"
                value={formatMoney(snap.adSpend, snap.store.currency)}
                hint="Ads del período"
              />
              <Kpi
                label="ROAS"
                value={
                  snap.roasCollected != null
                    ? `${snap.roasCollected.toFixed(2)}x`
                    : "—"
                }
                hint="Cobrado ÷ gasto"
                accent
              />
            </div>
          ))}
        </section>
      ) : null}

      {shopifyModalOpen ? (
        <ShopifyConnectModal
          shopDomain={shopDomain}
          subscription={subscription}
          onSubscriptionChange={setSubscription}
          onClose={() => setShopifyModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function normalizeShopDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

type BankAccount = {
  id: string;
  label: string;
  bank?: string;
  holder: string;
  accountNumber: string;
  cci?: string;
  notes?: string;
};

type RpSubscription = {
  status: string;
  isActive: boolean;
  activeUntil: string | null;
};

function ShopifyConnectModal({
  shopDomain,
  onClose,
  subscription,
  onSubscriptionChange,
}: {
  shopDomain: string;
  onClose: () => void;
  subscription: RpSubscription | null;
  onSubscriptionChange: (sub: RpSubscription) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [payStep, setPayStep] = useState<"offer" | "deposit" | "done">(
    subscription?.isActive ? "done" : "offer",
  );
  const [loadingPay, setLoadingPay] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const domain = normalizeShopDomain(shopDomain);
  const isActive = Boolean(subscription?.isActive) || payStep === "done";

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function startDeposit() {
    setLoadingPay(true);
    setPayError(null);
    try {
      const res = await fetch("/api/profit/subscribe", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopDomain: domain || undefined }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        alreadyActive?: boolean;
        paymentIntentId?: string;
        bankAccounts?: BankAccount[];
        subscription?: RpSubscription;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo iniciar el pago.");
      }
      if (json.alreadyActive && json.subscription) {
        onSubscriptionChange(json.subscription);
        setPayStep("done");
        return;
      }
      setPaymentIntentId(json.paymentIntentId ?? null);
      setBankAccounts(json.bankAccounts ?? []);
      setPayStep("deposit");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Error al iniciar pago");
    } finally {
      setLoadingPay(false);
    }
  }

  async function uploadProof() {
    if (!paymentIntentId || !proofFile) {
      setPayError("Elegí el voucher o comprobante.");
      return;
    }
    setUploading(true);
    setPayError(null);
    try {
      const form = new FormData();
      form.append("proof", proofFile);
      const res = await fetch(`/api/payments/intents/${paymentIntentId}/proof`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo subir el comprobante.");
      }
      onSubscriptionChange({
        status: "pending_payment",
        isActive: false,
        activeUntil: null,
      });
      setPayStep("done");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Error al subir voucher");
    } finally {
      setUploading(false);
    }
  }

  if (!mounted) return null;

  const realProfitUrl =
    process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() ||
    "https://www.realprofitcod.com";
  const installUrl = domain
    ? `${realProfitUrl.replace(/\/$/, "")}/api/shopify/auth?shop=${encodeURIComponent(domain)}&surface=web`
    : `${realProfitUrl.replace(/\/$/, "")}/api/shopify/auth?surface=web`;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1c1917]/55 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopify-connect-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ece7e0] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f0ebe4] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
              Gratuito vs Real Profit COD
            </p>
            <h3
              id="shopify-connect-title"
              className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]"
            >
              {payStep === "deposit"
                ? "Depósito $20 · Real Profit COD"
                : payStep === "done" && !isActive
                  ? "Comprobante en revisión"
                  : "Qué tenés hoy vs qué desbloqueás"}
            </h3>
            {domain ? (
              <p className="mt-1.5 font-mono text-[12px] text-[#8a8177]">
                {domain}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#8a8177] transition hover:bg-[#faf8f5] hover:text-[#1c1917]"
          >
            Cerrar
          </button>
        </div>

        {payStep === "offer" ? (
          <div className="grid gap-0 sm:grid-cols-2">
            <div className="flex flex-col border-b border-[#f0ebe4] px-5 py-5 sm:border-b-0 sm:border-r sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
                Incluido · Holistic
              </p>
              <p className="mt-2 text-[15px] font-bold text-[#1c1917]">
                Análisis de campañas
              </p>
              <ul className="mt-3 flex-1 space-y-2.5 text-[12.5px] leading-5 text-[#5c564e]">
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  Gasto TikTok (hoy, 7d, rango) + serie diaria
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  Ranking, BM, CTR / CPC / CPM
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  Spend hoy live + pacing y señales
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  Fee Holistic y BE ROAS estimado
                </li>
              </ul>
              <div className="mt-4 border-t border-[#f0ebe4] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8177]">
                  Precio
                </p>
                <p className="mt-1 text-[1.1rem] font-bold tabular-nums text-[#1c1917]">
                  $0{" "}
                  <span className="text-[12px] font-medium text-[#6b645c]">
                    · gratis
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-col px-5 py-5 sm:px-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#c2410c]">
                Con Shopify · Real Profit COD
              </p>
              <p className="mt-2 text-[15px] font-bold text-[#1c1917]">
                Ventas reales y ganancia neta
              </p>
              <ul className="mt-3 flex-1 space-y-2.5 text-[12.5px] leading-5 text-[#5c564e]">
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  Pedidos y ventas desde tu tienda
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  Cobrado COD · plata que sí llegó
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  ROAS / CPA sobre lo cobrado
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 font-semibold text-[#c2410c]">→</span>
                  Saber cuánto verdaderamente neto ganás
                </li>
              </ul>
              <div className="mt-4 border-t border-[#f0ebe4] pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8a8177]">
                  Precio cliente Holistic
                </p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-[14px] font-medium tabular-nums text-[#b0a89e] line-through">
                    $40
                  </span>
                  <span className="text-[1.1rem] font-bold tabular-nums text-[#1c1917]">
                    $20
                  </span>
                  <span className="text-[11px] font-medium text-[#6b645c]">
                    / mes
                  </span>
                </p>
                {payError ? (
                  <p className="mt-2 text-[12px] text-[#b91c1c]">{payError}</p>
                ) : null}
                <button
                  type="button"
                  disabled={loadingPay}
                  onClick={() => void startDeposit()}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] disabled:opacity-60"
                >
                  {loadingPay ? "Preparando…" : "Pagar $20 / mes"}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-[#9a9187]">
                  Transferencia a la misma cuenta Holistic + voucher. Sin
                  WhatsApp.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {payStep === "deposit" ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <p className="text-[13px] leading-5 text-[#5c564e]">
              Depositá <strong className="text-[#1c1917]">USD 20</strong> a
              esta cuenta (la misma de recargas Holistic) y subí el voucher.
              El equipo revisa y activa Real Profit COD.
            </p>
            <div className="space-y-3">
              {bankAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-4 py-3"
                >
                  <p className="text-[12px] font-bold text-[#1c1917]">
                    {acc.label}
                  </p>
                  <p className="mt-1 text-[12px] text-[#5c564e]">
                    Titular: {acc.holder}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] text-[#1c1917]">
                    Cuenta: {acc.accountNumber}
                  </p>
                  {acc.cci ? (
                    <p className="mt-0.5 font-mono text-[12px] text-[#1c1917]">
                      CCI: {acc.cci}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
              Comprobante
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="mt-1.5 block w-full text-[13px] font-medium normal-case tracking-normal text-[#1c1917]"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {payError ? (
              <p className="text-[12px] text-[#b91c1c]">{payError}</p>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPayStep("offer")}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-[#e7e0d8] px-4 text-[13px] font-semibold text-[#5c564e]"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={uploading || !proofFile}
                onClick={() => void uploadProof()}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#1c1917] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
              >
                {uploading ? "Subiendo…" : "Enviar voucher"}
              </button>
            </div>
          </div>
        ) : null}

        {payStep === "done" ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {isActive ? (
              <>
                <p className="text-[13px] leading-5 text-[#5c564e]">
                  Real Profit COD activo
                  {subscription?.activeUntil
                    ? ` hasta ${subscription.activeUntil.slice(0, 10)}`
                    : ""}
                  . Instalá la app en Shopify para jalar pedidos
                  automáticamente.
                </p>
                <a
                  href={installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12]"
                >
                  Instalar app en Shopify
                </a>
              </>
            ) : (
              <p className="text-[13px] leading-5 text-[#5c564e]">
                Comprobante enviado. Cuando el equipo lo apruebe, vas a poder
                instalar Real Profit en Shopify desde acá.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
