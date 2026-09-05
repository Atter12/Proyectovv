"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAdAccountLiveMetrics } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { formatMoney } from "@/lib/format-money";
import { moneyUsd } from "@/lib/format/money-usd";

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

function DailyBars({ series }: { series: DailyPoint[] }) {
  const max = Math.max(...series.map((p) => p.spend), 0);
  const peak = max > 0 ? max : 1;
  const hasAny = series.some((p) => p.spend > 0);
  const mobile = series.slice(-7);

  if (!hasAny) {
    return (
      <p className="px-1 py-6 text-[13px] text-[#8a8177]">
        Sin gasto diario en este período. Cuando haya snapshots TikTok o filas
        de gasto con fecha, aparecen acá.
      </p>
    );
  }

  return (
    <>
      <div className="sm:hidden">
        <div className="flex h-28 items-end gap-1">
          {mobile.map((p) => (
            <div
              key={p.date}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${p.date}: ${moneyUsd(p.spend)}`}
            >
              <div
                className="w-full rounded-t-md bg-[#ff781f]/85"
                style={{
                  height: `${Math.max(4, (p.spend / peak) * 100)}%`,
                }}
              />
              <span className="text-[9px] tabular-nums text-[#9a9187]">
                {p.date.slice(8)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#8a8177]">Últimos 7 días del rango</p>
      </div>
      <div className="hidden sm:block">
        <div className="flex h-32 items-end gap-0.5">
          {series.map((p) => (
            <div
              key={p.date}
              className="flex min-w-0 flex-1 flex-col items-center"
              title={`${p.date}: ${moneyUsd(p.spend)}`}
            >
              <div
                className="w-full max-w-[14px] rounded-t bg-[#ff781f]/80 transition hover:bg-[#ff781f]"
                style={{
                  height: `${Math.max(3, (p.spend / peak) * 100)}%`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] tabular-nums text-[#9a9187]">
          <span>{series[0]?.date}</span>
          <span>{series.at(-1)?.date}</span>
        </div>
      </div>
    </>
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
  const [realProfitUrl, setRealProfitUrl] = useState(
    "https://www.realprofitcod.com",
  );
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [bmFilter, setBmFilter] = useState<string>("all");
  const [shopifyModalOpen, setShopifyModalOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");

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
  const liveBalanceTotal = liveAccounts.reduce(
    (s, a) => s + (a.balanceUsd ?? 0),
    0,
  );
  const liveSpendTotal = liveAccounts.reduce(
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
        realProfitUrl?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo cargar Profit.");
      }
      setAnalysis(json.analysis ?? null);
      setSnapshots(
        (json.snapshots ?? []).filter((s) => s.store.id !== "__holistic_tiktok__"),
      );
      if (!from && json.from) setFrom(json.from);
      if (!to && json.to) setTo(json.to);
      if (json.realProfitUrl) setRealProfitUrl(json.realProfitUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const spendTodayDisplay = analysis
    ? useLiveForToday
      ? liveSpendTotal
      : analysis.spendToday
    : 0;
  const hoyHint = analysis
    ? useLiveForToday
      ? `Live TikTok${
          liveBalanceTotal > 0
            ? ` · saldo ${moneyUsd(liveBalanceTotal)}`
            : ""
        }${formatSyncTime(live.lastUpdatedAt) ? ` · ${formatSyncTime(live.lastUpdatedAt)}` : ""}`
      : `vs ayer ${formatDelta(analysis.spendTodayDeltaPct)} · ${moneyUsd(analysis.spendYesterday)}`
    : "";

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
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-[#ece7e0] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_45%,#f7f4ef_100%)] px-5 py-6 sm:px-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#ff781f]/[0.12] blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
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
          <button
            type="button"
            onClick={openShopifyModal}
            className="inline-flex h-auto max-w-[16rem] shrink-0 items-center justify-center rounded-xl border border-[#ffd7b8] bg-white px-4 py-2.5 text-left text-[12.5px] font-semibold leading-snug text-[#c2410c] transition hover:border-[#ff781f] hover:bg-[#fff7f0] sm:max-w-[18rem]"
          >
            Conectar tienda de Shopify para jalar pedidos y ventas →
          </button>
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

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#ece7e0] bg-white p-4 sm:p-5">
        <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
          Desde
          <input
            type="date"
            className="mt-1.5 block rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2.5 text-[13px] font-medium text-[#1c1917] outline-none ring-[#ff781f]/30 focus:bg-white focus:ring-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
          Hasta
          <input
            type="date"
            className="mt-1.5 block rounded-xl border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2.5 text-[13px] font-medium text-[#1c1917] outline-none ring-[#ff781f]/30 focus:bg-white focus:ring-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex h-11 items-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] disabled:opacity-50"
        >
          {loading ? "Cargando…" : "Actualizar"}
        </button>
      </section>

      {loading && !analysis ? (
        <p className="text-[13px] text-[#8a8177]">Cargando análisis…</p>
      ) : analysis ? (
        <>
          <section className="space-y-4 rounded-2xl border border-[#ece7e0] bg-white p-5 shadow-[0_10px_28px_-22px_rgb(28_25_23_/_0.35)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                  Consumo TikTok
                </p>
                <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]">
                  Gasto · Holistic
                </h2>
                <p className="mt-0.5 text-[12px] text-[#8a8177]">
                  America/Lima · {analysis.from} → {analysis.to} ·{" "}
                  {analysis.daysWithActivity} días con actividad
                  {analysis.dataThroughDate
                    ? ` · datos hasta ${analysis.dataThroughDate}`
                    : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pacingBadge(displayPacing.pacingLabel).className}`}
              >
                {pacingBadge(displayPacing.pacingLabel).text}
                {displayPacing.pacingRatio != null
                  ? ` · ${displayPacing.pacingRatio.toFixed(2)}×`
                  : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label={useLiveForToday ? "Hoy · live" : "Hoy"}
                value={
                  live.loading && !live.lastUpdatedAt
                    ? "…"
                    : moneyUsd(spendTodayDisplay)
                }
                hint={hoyHint}
                accent={useLiveForToday && spendTodayDisplay > 0}
              />
              <Kpi
                label="7 días"
                value={moneyUsd(analysis.spend7d)}
                hint={`vs 7d previos ${formatDelta(analysis.spend7dDeltaPct)}`}
              />
              <Kpi
                label="30 días"
                value={moneyUsd(analysis.spend30d)}
                hint="Ventana corta"
              />
              <Kpi
                label="En el rango"
                value={moneyUsd(analysis.spendInRange)}
                hint={`vs período anterior ${formatDelta(analysis.spendRangeDeltaPct)} · ${analysis.campaigns.length} campañas`}
                accent={!useLiveForToday || spendTodayDisplay <= 0}
              />
            </div>

            {useLiveForToday && liveAccounts.length > 0 ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#8a8177]">
                <span>
                  {liveAccounts.length === 1
                    ? liveAccounts[0]!.accountName
                    : `${liveAccounts.length} cuentas`}
                  {liveBalanceTotal > 0
                    ? ` · saldo ${moneyUsd(liveBalanceTotal)}`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void live.refresh({ force: true })}
                  className="font-semibold text-[#c2410c] underline-offset-2 hover:underline"
                >
                  Actualizar live
                </button>
              </p>
            ) : null}

            <div className="rounded-xl border border-[#f0ebe4] bg-[#faf8f5] px-4 py-4">
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                Serie diaria
              </p>
              <DailyBars series={analysis.dailySeries} />
            </div>

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
                  Impresiones / CTR / CPC desde report live. Cobrado COD por
                  campaña = estimado si hay tienda vinculada.
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
                <table className="min-w-full text-left text-[12px]">
                  <thead className="bg-[#faf8f5] text-[10px] uppercase tracking-[0.08em] text-[#9a9187]">
                    <tr>
                      <th className="px-3 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.08em]"
                          onClick={() => toggleSort("name")}
                        >
                          Campaña
                        </button>
                      </th>
                      <th className="px-3 py-2.5">BM</th>
                      <th className="px-3 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.08em]"
                          onClick={() => toggleSort("spend")}
                        >
                          Gasto
                        </button>
                      </th>
                      <th className="px-3 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.08em]"
                          onClick={() => toggleSort("share")}
                        >
                          %
                        </button>
                      </th>
                      <th className="px-3 py-2.5">Imp.</th>
                      <th className="px-3 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.08em]"
                          onClick={() => toggleSort("ctr")}
                        >
                          CTR
                        </button>
                      </th>
                      <th className="px-3 py-2.5">
                        <button
                          type="button"
                          className="font-bold uppercase tracking-[0.08em]"
                          onClick={() => toggleSort("cpc")}
                        >
                          CPC
                        </button>
                      </th>
                      <th className="px-3 py-2.5">CPM</th>
                      <th className="px-3 py-2.5">Conv.</th>
                      {analysis.hasCodLink ? (
                        <>
                          <th className="px-3 py-2.5">Cobrado est.</th>
                          <th className="px-3 py-2.5">
                            <button
                              type="button"
                              className="font-bold uppercase tracking-[0.08em]"
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
                    {sortedCampaigns.map((c) => (
                      <tr
                        key={`${c.platform}-${c.campaignExternalId}-${c.advertiserId ?? ""}`}
                        className="border-t border-[#f0ebe4]"
                      >
                        <td className="px-3 py-2.5 font-medium text-[#1c1917]">
                          {c.campaignName}
                          <span className="mt-0.5 block text-[10px] font-normal text-[#9a9187]">
                            {c.hasTikTokPerf ? "perf TikTok" : "solo Holistic"}
                            {c.advertiserId ? ` · ${c.advertiserId}` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[#6b645c]">
                          {c.bm ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {moneyUsd(c.spend)}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {(c.spendShare * 100).toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {c.impressions != null
                            ? c.impressions.toLocaleString("en-US")
                            : "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {c.ctr != null ? `${c.ctr.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {c.cpc != null ? moneyUsd(c.cpc) : "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {c.cpm != null ? moneyUsd(c.cpm) : "—"}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {c.conversions != null
                            ? c.conversions.toLocaleString("en-US")
                            : "—"}
                        </td>
                        {analysis.hasCodLink ? (
                          <>
                            <td className="px-3 py-2.5 tabular-nums">
                              {formatMoney(c.collectedEstimated, "PEN")}
                            </td>
                            <td className="px-3 py-2.5 font-semibold tabular-nums text-[#c2410c]">
                              {c.roasEstimated != null
                                ? `${c.roasEstimated.toFixed(2)}x`
                                : "—"}
                            </td>
                          </>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section
        id="profit-shopify-connect"
        className="scroll-mt-6 overflow-hidden rounded-2xl border border-[#ece7e0] bg-white shadow-[0_12px_32px_-24px_rgb(28_25_23_/_0.4)]"
      >
        <div className="relative px-5 py-6 sm:px-7 sm:py-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-[#ff781f]/[0.08] blur-3xl"
          />
          <p className="relative text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Pedidos y ventas
          </p>
          <h2 className="relative mt-1.5 max-w-lg text-[1.25rem] font-bold tracking-[-0.03em] text-[#1c1917] sm:text-[1.4rem]">
            Conectá tu tienda Shopify
          </h2>
          <p className="relative mt-2 max-w-xl text-[13px] leading-5 text-[#5c564e]">
            Jalá pedidos y ventas reales para ver cuánto estás ganando neto —
            no solo cuánto gastás en ads.
          </p>
          <label className="relative mt-5 block max-w-md text-[11px] font-bold uppercase tracking-[0.1em] text-[#8a8177]">
            Dominio de tu tienda
            <div className="mt-1.5 flex overflow-hidden rounded-xl border border-[#e7e0d8] bg-[#faf8f5] focus-within:border-[#ff781f] focus-within:ring-2 focus-within:ring-[#ff781f]/25">
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
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-[13px] font-medium normal-case tracking-normal text-[#1c1917] outline-none placeholder:text-[#b0a89e]"
              />
            </div>
          </label>
          <button
            type="button"
            onClick={openShopifyModal}
            className="relative mt-4 inline-flex h-11 items-center rounded-xl bg-[#ff781f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#f06a12]"
          >
            Conectar Shopify
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
          realProfitUrl={realProfitUrl}
          shopDomain={shopDomain}
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

function ShopifyConnectModal({
  realProfitUrl,
  shopDomain,
  onClose,
}: {
  realProfitUrl: string;
  shopDomain: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const domain = normalizeShopDomain(shopDomain);

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

  const continueUrl = (() => {
    try {
      const u = new URL(realProfitUrl);
      if (domain) u.searchParams.set("shop", domain);
      return u.toString();
    } catch {
      return realProfitUrl;
    }
  })();

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1c1917]/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shopify-connect-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#ece7e0] bg-white shadow-[0_24px_64px_-28px_rgb(28_25_23_/_0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#f0ebe4] px-5 py-4 sm:px-6">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
              Antes de conectar
            </p>
            <h3
              id="shopify-connect-title"
              className="mt-1 text-[1.15rem] font-bold tracking-[-0.02em] text-[#1c1917]"
            >
              Qué tenés hoy vs qué desbloqueás
            </h3>
            {domain ? (
              <p className="mt-1 font-mono text-[12px] text-[#8a8177]">
                {domain}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-[#8a8177] hover:bg-[#faf8f5] hover:text-[#1c1917]"
          >
            Cerrar
          </button>
        </div>

        <div className="grid gap-0 sm:grid-cols-2">
          <div className="flex flex-col border-b border-[#f0ebe4] px-5 py-5 sm:border-b-0 sm:border-r sm:px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              Ya incluido · Holistic
            </p>
            <p className="mt-2 text-[15px] font-bold text-[#1c1917]">
              Análisis de campañas
            </p>
            <ul className="mt-3 flex-1 space-y-2.5 text-[12.5px] leading-5 text-[#5c564e]">
              <li className="flex gap-2">
                <span className="mt-0.5 text-[#c4bdb4]">✓</span>
                Gasto TikTok (hoy, 7d, rango) + serie diaria
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-[#c4bdb4]">✓</span>
                Ranking, BM, CTR / CPC / CPM
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-[#c4bdb4]">✓</span>
                Spend hoy live + pacing y señales
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-[#c4bdb4]">✓</span>
                Fee Holistic y BE ROAS estimado
              </li>
            </ul>
            <p className="mt-4 text-[11px] font-medium text-[#9a9187]">
              Sabés cuánto gastás. Todavía no cuánto cobrás de verdad.
            </p>
            <p className="mt-3 text-[1.05rem] font-bold tabular-nums text-[#1c1917]">
              $0{" "}
              <span className="text-[12px] font-semibold text-[#6b645c]">
                · gratis
              </span>
            </p>
          </div>

          <div className="flex flex-col bg-[linear-gradient(160deg,#fffaf6_0%,#ffffff_55%)] px-5 py-5 sm:px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ff781f]">
              Al conectar Shopify
            </p>
            <p className="mt-2 text-[15px] font-bold text-[#1c1917]">
              Ventas reales y ganancia neta
            </p>
            <ul className="mt-3 flex-1 space-y-2.5 text-[12.5px] leading-5 text-[#5c564e]">
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-[#ff781f]">→</span>
                Pedidos y ventas desde tu tienda
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-[#ff781f]">→</span>
                Cobrado COD · plata que sí llegó
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-[#ff781f]">→</span>
                ROAS / CPA sobre lo cobrado (no solo ads)
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-[#ff781f]">→</span>
                Saber cuánto verdaderamente neto ganás
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 font-bold text-[#ff781f]">→</span>
                Camino a TikTok Shop y más canales
              </li>
            </ul>
            <p className="mt-4 text-[12px] font-semibold leading-5 text-[#1c1917]">
              Ahí ves si de verdad estás ganando — no solo gastando.
            </p>
            <p className="mt-3 text-[1.05rem] font-bold tabular-nums text-[#c2410c]">
              +$20{" "}
              <span className="text-[12px] font-semibold text-[#9a3412]">
                · Real Profit COD
              </span>
            </p>
          </div>
        </div>

        <div className="border-t border-[#f0ebe4] bg-[#faf8f5] px-5 py-4 sm:px-6">
          <a
            href={continueUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff781f] px-5 text-[13px] font-semibold text-white transition hover:bg-[#f06a12] sm:w-auto"
          >
            Continuar en Real Profit →
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
