"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
              Gasto TikTok, ranking, CTR/CPC y señales — gratis en Holistic.
              Pedidos cobrados y ROAS COD vienen con Real Profit (+$20).
            </p>
          </div>
          <a
            href={realProfitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12]"
          >
            Real Profit COD · +$20 →
          </a>
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
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${pacingBadge(analysis.pacingLabel).className}`}
              >
                {pacingBadge(analysis.pacingLabel).text}
                {analysis.pacingRatio != null
                  ? ` · ${analysis.pacingRatio.toFixed(2)}×`
                  : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Hoy"
                value={moneyUsd(analysis.spendToday)}
                hint={`vs ayer ${formatDelta(analysis.spendTodayDeltaPct)} · ${moneyUsd(analysis.spendYesterday)}`}
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
                accent
              />
            </div>

            <div className="rounded-xl border border-[#ece7e0] bg-[#faf8f5] px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                    Live TikTok
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#5c564e]">
                    Saldo y spend hoy por cuenta · poll ~{live.pollSeconds}s
                    {formatSyncTime(live.lastUpdatedAt)
                      ? ` · ${formatSyncTime(live.lastUpdatedAt)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void live.refresh({ force: true })}
                  className="text-[12px] font-semibold text-[#c2410c] underline-offset-2 hover:underline"
                >
                  Refrescar live
                </button>
              </div>
              {live.error ? (
                <p className="mt-2 text-[12px] text-amber-900">{live.error}</p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#9a9187]">
                    Saldo total
                  </p>
                  <p className="mt-0.5 text-[1.05rem] font-bold tabular-nums text-[#1c1917]">
                    {live.loading && liveAccounts.length === 0
                      ? "…"
                      : moneyUsd(liveBalanceTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#9a9187]">
                    Spend hoy (live)
                  </p>
                  <p className="mt-0.5 text-[1.05rem] font-bold tabular-nums text-[#c2410c]">
                    {live.loading && liveAccounts.length === 0
                      ? "…"
                      : moneyUsd(liveSpendTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#9a9187]">
                    Cuentas activas
                  </p>
                  <p className="mt-0.5 text-[1.05rem] font-bold tabular-nums text-[#1c1917]">
                    {liveAccounts.length}
                  </p>
                </div>
              </div>
              {liveAccounts.length > 0 ? (
                <ul className="mt-3 divide-y divide-[#ece7e0] rounded-xl border border-[#ece7e0] bg-white">
                  {liveAccounts.slice(0, 6).map((a) => (
                    <li
                      key={a.advertiserId}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[12px]"
                    >
                      <span className="min-w-0 font-medium text-[#1c1917]">
                        {a.accountName}
                        {a.bmBucket ? (
                          <span className="ml-2 text-[10px] font-normal text-[#8a8177]">
                            BM {a.bmBucket}
                          </span>
                        ) : null}
                      </span>
                      <span className="tabular-nums text-[#5c564e]">
                        hoy {moneyUsd(a.spendTodayUsd ?? 0)}
                        <span className="mx-1.5 text-[#d6cec4]">·</span>
                        saldo {moneyUsd(a.balanceUsd ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : !live.loading ? (
                <p className="mt-2 text-[12px] text-[#8a8177]">
                  Sin saldo ni spend live en cuentas mapeadas.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#f0ebe4] bg-[#faf8f5] px-4 py-4">
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                Serie diaria
              </p>
              <DailyBars series={analysis.dailySeries} />
            </div>

            {(analysis.signals?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                  Señales
                </p>
                {analysis.signals.map((sig, i) => (
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
                . Vinculá Real Profit COD (+$20) para CPA / ROAS cobrado.
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

      <section className="rounded-2xl border border-dashed border-[#ffd7b8] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_60%)] p-5 sm:p-6">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
          Extra · Real Profit COD · +$20
        </p>
        <h2 className="mt-1 text-[1.1rem] font-bold tracking-[-0.02em] text-[#1c1917]">
          Cobrado real desde tu tienda
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#5c564e]">
          Holistic ya te da gasto y performance de campañas. Para jalar{" "}
          <span className="font-semibold text-[#1c1917]">pedidos cobrados</span>{" "}
          (Shopify u otra tienda), ROAS COD y operación completa, activá Real
          Profit COD. Ahí se conecta la tienda — no desde este panel gratis.
        </p>
        <ul className="mt-3 space-y-1 text-[12.5px] text-[#5c564e]">
          <li>· Pedidos / cobrado COD sincronizados</li>
          <li>· ROAS y CPA sobre plata que sí llegó</li>
          <li>· Conexión a tienda (Shopify y más canales vía RP)</li>
        </ul>
        <a
          href={realProfitUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex h-11 items-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12]"
        >
          Abrir Real Profit COD →
        </a>
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
                  Datos Real Profit · cobrado del período
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
    </div>
  );
}
