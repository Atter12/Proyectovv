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
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);
  const [linkErr, setLinkErr] = useState<string | null>(null);

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

  const retryLinkStore = useCallback(async () => {
    setLinkBusy(true);
    setLinkErr(null);
    setLinkMsg(null);
    try {
      const res = await fetch("/api/profit/link-retry", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: shopDomain.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(
          json.error || "No se pudo vincular. Instala la app y reintenta.",
        );
      }
      setLinkMsg(json.message || "Tienda vinculada.");
      await refresh();
    } catch (e) {
      setLinkErr(e instanceof Error ? e.message : "Error al vincular");
    } finally {
      setLinkBusy(false);
    }
  }, [shopDomain, refresh]);

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
            Gasto TikTok live, ranking de campañas y CTR/CPC del rango —
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
        <p className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
          Rango de calendario
        </p>
        <p className="mb-3 max-w-xl text-[12.5px] leading-5 text-[#5c564e]">
          Filtra el ranking y el performance TikTok. El gasto live de arriba
          siempre es solo hoy.
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
      </section>

      {loading && !analysis ? (
        <p className="text-[13px] text-[#8a8177]">Cargando análisis…</p>
      ) : analysis ? (
        <>
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
                  {analysis.daysWithActivity
                    ? ` · ${analysis.daysWithActivity} días con gasto`
                    : ""}
                  {analysis.perf?.fetchedAt
                    ? ` · perf act. ${formatSyncTime(analysis.perf.fetchedAt)}`
                    : ""}
                  {" · en el rango "}
                  <span className="font-semibold text-[#1c1917]">
                    {moneyUsd(analysis.spendInRange)}
                  </span>
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
                . Conecta tu tienda abajo para CPA / ganancia neta.
              </div>
            ) : null}

            {sortedCampaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-8 text-center">
                <p className="text-[13px] font-semibold text-[#1c1917]">
                  Sin campañas con gasto en este período
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-[#5c564e]">
                  Prueba otro rango o espera a que sync TikTok escriba snapshots.
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
        className="scroll-mt-6 overflow-hidden rounded-2xl border border-[var(--auth-border)] bg-white"
      >
        {subscription?.isActive && analysis && !analysis.hasCodLink ? (
          <div className="border-b border-[#ffd7b8] bg-[#fff7f0] px-5 py-4 sm:px-6">
            <p className="text-[13px] font-bold text-[#9a3412]">
              COD activo · falta vincular la tienda
            </p>
            <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-[#9a3412]/90">
              Ya pagaste Real Profit. Instala la app en Shopify (si aún no) y
              toca <span className="font-semibold">Ya instalé — vincular</span>{" "}
              para jalar pedidos cobrados.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href={
                  shopDomain.trim()
                    ? `${(process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() || "https://www.realprofitcod.com").replace(/\/$/, "")}/api/shopify/auth?shop=${encodeURIComponent(normalizeShopDomain(shopDomain))}&surface=web`
                    : `${(process.env.NEXT_PUBLIC_REALPROFIT_URL?.trim() || "https://www.realprofitcod.com").replace(/\/$/, "")}/api/shopify/auth?surface=web`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#ffd7b8] bg-white px-4 text-[13px] font-semibold text-[#c2410c] transition hover:bg-[#fffaf6]"
              >
                Instalar app Shopify
              </a>
              <button
                type="button"
                disabled={linkBusy}
                onClick={() => void retryLinkStore()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05] disabled:opacity-60"
              >
                {linkBusy ? "Vinculando…" : "Ya instalé — vincular"}
              </button>
            </div>
            {linkErr ? (
              <p className="mt-2 text-[12px] font-medium text-[#b91c1c]">
                {linkErr}
              </p>
            ) : null}
            {linkMsg ? (
              <p className="mt-2 text-[12px] font-medium text-emerald-800">
                {linkMsg}
              </p>
            ) : null}
          </div>
        ) : null}

        {analysis?.hasCodLink ? (
          <div className="border-b border-[var(--auth-divider)] px-5 py-5 sm:px-6">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-emerald-700">
              Shopify · conectada
            </p>
            <h2 className="mt-1.5 text-[1.25rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
              Pedidos COD sincronizados
            </h2>
            <p className="mt-1 max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
              Estamos jalando lo cobrado real de tu tienda para el ROAS / CPA
              del período.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--auth-divider)] bg-[linear-gradient(145deg,#fffaf6_0%,#ffffff_55%,#faf8f5_100%)] px-5 py-5 sm:px-6">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
                Con Shopify · Real Profit COD
              </p>
              <h2 className="mt-1.5 max-w-lg text-[1.35rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)] sm:text-[1.45rem]">
                ¿Vendes en Shopify?
              </h2>
              <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
                Conecta tu tienda para jalar pedidos y ventas reales. Mira la
                plata que{" "}
                <span className="font-semibold text-[var(--auth-text)]">
                  sí cobraste
                </span>
                — no solo el gasto en ads. ROAS y CPA sobre lo cobrado COD.
              </p>

              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {[
                  "Pedidos y ventas desde tu tienda",
                  "Cobrado COD · plata que sí llegó",
                  "ROAS / CPA sobre lo cobrado",
                  "Saber cuánto verdaderamente neto ganas",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[13px] leading-5 text-[var(--auth-text-muted)]"
                  >
                    <span
                      className="mt-0.5 font-semibold text-[var(--auth-accent)]"
                      aria-hidden
                    >
                      →
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-[var(--auth-divider)] pt-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
                    Precio cliente Holistic
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-[15px] font-medium tabular-nums text-[#b0a89e] line-through">
                      $40
                    </span>
                    <span className="text-[1.35rem] font-bold tabular-nums text-[var(--auth-text)]">
                      $20
                    </span>
                    <span className="text-[12px] font-medium text-[var(--auth-text-muted)]">
                      / mes
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <p className="mb-3 text-[13px] font-semibold text-[var(--auth-text)]">
                Dominio de tu tienda
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--auth-border)] bg-[#faf8f5] transition focus-within:border-[var(--auth-accent)]/45 focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--auth-accent)]/20">
                  <span className="flex items-center border-r border-[var(--auth-border)] bg-[#f3efe9] px-3 text-[12px] font-medium text-[var(--auth-text-muted)]">
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
                        if (
                          subscription?.isActive &&
                          analysis &&
                          !analysis.hasCodLink
                        ) {
                          void retryLinkStore();
                        } else {
                          openShopifyModal();
                        }
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-[14px] font-medium text-[var(--auth-text)] outline-none placeholder:text-[#b0a89e]"
                  />
                </div>
                {subscription?.isActive && analysis && !analysis.hasCodLink ? (
                  <button
                    type="button"
                    disabled={linkBusy}
                    onClick={() => void retryLinkStore()}
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] disabled:opacity-60 sm:w-auto"
                  >
                    {linkBusy ? "Vinculando…" : "Vincular tienda"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openShopifyModal}
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.2)] transition-[filter,transform] hover:brightness-[1.05] active:scale-[0.98] sm:w-auto"
                  >
                    Conectar Shopify · $20/mes
                  </button>
                )}
              </div>
              <p className="mt-4 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                Transferencia a la misma cuenta Holistic + voucher. Activación
                cuando el equipo aprueba el comprobante.
              </p>
              <a
                href={`https://wa.me/51933484150?text=${encodeURIComponent(
                  "Hola, tengo dudas e interés para adquirir Real Profit COD",
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-3 rounded-xl border border-[#dcfce7] bg-[#f0fdf4] px-3.5 py-2.5 transition hover:border-[#86efac] hover:bg-[#ecfdf5]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_4px_12px_rgb(37_211_102_/_0.35)]">
                  <svg
                    className="h-[18px] w-[18px]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[13px] font-semibold text-[#166534]">
                    ¿Tienes dudas? Escríbenos
                  </span>
                  <span className="block text-[11.5px] text-[#15803d]/90">
                    Te respondemos por WhatsApp · Real Profit COD
                  </span>
                </span>
              </a>
            </div>
          </>
        )}
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
          onLinked={async () => {
            await refresh();
          }}
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
  onLinked,
}: {
  shopDomain: string;
  onClose: () => void;
  subscription: RpSubscription | null;
  onSubscriptionChange: (sub: RpSubscription) => void;
  onLinked?: () => void | Promise<void>;
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
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);
  const domain = normalizeShopDomain(shopDomain);
  const isActive = Boolean(subscription?.isActive);
  const awaitingReview = payStep === "done" && !isActive;

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
      setPayError("Elige el voucher o comprobante.");
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
                : awaitingReview
                  ? "Comprobante en revisión"
                  : isActive
                    ? "Real Profit COD activo"
                    : "Qué tienes hoy vs qué desbloqueas"}
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
                  Gasto TikTok live + ranking del rango
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  Impresiones, CTR / CPC / CPM
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  Spend hoy en vivo + fee Holistic
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 text-[#a8a29e]">✓</span>
                  BE ROAS estimado (ads + fee)
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
                  Saber cuánto verdaderamente neto ganas
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
                  Transferencia a la misma cuenta Holistic + voucher.
                </p>
                <a
                  href={`https://wa.me/51933484150?text=${encodeURIComponent(
                    "Hola, tengo dudas e interés para adquirir Real Profit COD",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dcfce7] bg-[#f0fdf4] px-3 py-2.5 text-[12.5px] font-semibold text-[#166534] transition hover:bg-[#ecfdf5]"
                >
                  <svg
                    className="h-4 w-4 text-[#25D366]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  ¿Tienes dudas? Escríbenos
                </a>
              </div>
            </div>
          </div>
        ) : null}

        {payStep === "deposit" ? (
          <div className="space-y-4 px-5 py-5 sm:px-6">
            <p className="text-[13px] leading-5 text-[#5c564e]">
              Depositá <strong className="text-[#1c1917]">USD 20</strong> a
              esta cuenta (la misma de recargas Holistic) y sube el voucher.
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
                  . Instala la app en Shopify y después vincula para jalar
                  pedidos cobrados.
                </p>
                <a
                  href={installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white transition hover:bg-[#f06a12]"
                >
                  Instalar app en Shopify
                </a>
                <button
                  type="button"
                  disabled={linkBusy}
                  onClick={() => {
                    void (async () => {
                      setLinkBusy(true);
                      setLinkFeedback(null);
                      setPayError(null);
                      try {
                        const res = await fetch("/api/profit/link-retry", {
                          method: "POST",
                          cache: "no-store",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            shopDomain: domain || undefined,
                          }),
                        });
                        const json = (await res.json()) as {
                          ok?: boolean;
                          message?: string;
                          error?: string;
                        };
                        if (!res.ok || !json.ok) {
                          throw new Error(
                            json.error ||
                              "No se pudo vincular. Instala la app y reintenta.",
                          );
                        }
                        setLinkFeedback(json.message || "Tienda vinculada.");
                        await onLinked?.();
                      } catch (e) {
                        setPayError(
                          e instanceof Error ? e.message : "Error al vincular",
                        );
                      } finally {
                        setLinkBusy(false);
                      }
                    })();
                  }}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#1c1917] transition hover:bg-[#faf8f5] disabled:opacity-60"
                >
                  {linkBusy ? "Vinculando…" : "Ya instalé — vincular"}
                </button>
                {linkFeedback ? (
                  <p className="text-[12px] font-medium text-emerald-800">
                    {linkFeedback}
                  </p>
                ) : null}
                {payError ? (
                  <p className="text-[12px] text-[#b91c1c]">{payError}</p>
                ) : null}
              </>
            ) : (
              <p className="text-[13px] leading-5 text-[#5c564e]">
                Comprobante enviado. Cuando el equipo lo apruebe, vas a poder
                instalar Real Profit en Shopify y vincular desde acá.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
