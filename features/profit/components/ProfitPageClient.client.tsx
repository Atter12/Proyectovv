"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
};

type DailyPoint = { date: string; spend: number };

type Analysis = {
  from: string;
  to: string;
  spendToday: number;
  spend7d: number;
  spend30d: number;
  spendInRange: number;
  daysWithActivity: number;
  dailySeries: DailyPoint[];
  campaigns: CampaignRow[];
  collectedRevenue: number;
  roasCollected: number | null;
  hasCodLink: boolean;
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

type SortKey = "spend" | "share" | "name" | "roas";

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
  isStaff,
}: {
  clienteName: string;
  isStaff: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [linkedStores, setLinkedStores] = useState<StoreSummary[]>([]);
  const [allStores, setAllStores] = useState<StoreSummary[]>([]);
  const [pickStoreId, setPickStoreId] = useState("");
  const [linking, setLinking] = useState(false);
  const [realProfitUrl, setRealProfitUrl] = useState(
    "https://www.realprofitcod.com",
  );
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [bmFilter, setBmFilter] = useState<string>("all");

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
        linkedStores?: StoreSummary[];
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
      setLinkedStores(json.linkedStores ?? []);
      if (!from && json.from) setFrom(json.from);
      if (!to && json.to) setTo(json.to);
      if (json.realProfitUrl) setRealProfitUrl(json.realProfitUrl);

      if (isStaff) {
        const sRes = await fetch("/api/profit/stores", { cache: "no-store" });
        const sJson = (await sRes.json()) as {
          ok?: boolean;
          stores?: StoreSummary[];
          error?: string;
        };
        if (sRes.ok && sJson.ok) {
          setAllStores(sJson.stores ?? []);
          setPickStoreId((prev) => prev || sJson.stores?.[0]?.id || "");
        } else if (!sRes.ok) {
          setError(sJson.error || "No se pudieron listar tiendas RP.");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [from, to, isStaff]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLink() {
    if (!pickStoreId) return;
    setLinking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/profit/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: pickStoreId, action: "link" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se vinculó.");
      setNotice("Tienda vinculada. Cobrado COD entra al análisis.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al vincular");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(storeId: string) {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/profit/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, action: "unlink" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se desvinculó.");
      setNotice("Tienda desvinculada.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  const linkedIds = new Set(linkedStores.map((s) => s.id));
  const availableStores = allStores.filter((s) => !linkedIds.has(s.id));

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

  const topShare = sortedCampaigns[0]?.spendShare ?? 0;

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
              Gasto TikTok, ranking de campañas y señales para decidir dónde
              poner o cortar plata. Cobrado COD es opcional si tenés Real Profit
              vinculado.
            </p>
          </div>
          <a
            href={realProfitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-[#d6cec4] bg-white px-4 text-[13px] font-semibold text-[#1c1917] transition hover:border-[#ff781f]"
          >
            Real Profit COD →
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
      {notice ? (
        <div
          className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950"
          role="status"
        >
          {notice}
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
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Hoy"
                value={moneyUsd(analysis.spendToday)}
                hint="Día actual (Lima)"
              />
              <Kpi
                label="7 días"
                value={moneyUsd(analysis.spend7d)}
                hint="Incluye hoy"
              />
              <Kpi
                label="30 días"
                value={moneyUsd(analysis.spend30d)}
                hint="Ventana corta"
              />
              <Kpi
                label="En el rango"
                value={moneyUsd(analysis.spendInRange)}
                hint={`${analysis.campaigns.length} campañas`}
                accent
              />
            </div>

            <div className="rounded-xl border border-[#f0ebe4] bg-[#faf8f5] px-4 py-4">
              <p className="mb-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                Serie diaria
              </p>
              <DailyBars series={analysis.dailySeries} />
            </div>

            {topShare >= 0.4 && sortedCampaigns[0] ? (
              <div className="rounded-xl border border-[#ffd7b8] bg-[#fff7f0] px-4 py-3 text-[13px] text-[#9a3412]">
                <span className="font-semibold">
                  {sortedCampaigns[0].campaignName}
                </span>{" "}
                se lleva el {(topShare * 100).toFixed(0)}% del gasto del período.
                Revisá si el ROAS / resultado lo justifica.
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
                  Ranking por gasto
                </h2>
                <p className="mt-0.5 text-[12px] text-[#5c564e]">
                  Cobrado / ROAS por campaña = estimado si hay COD vinculado
                  (reparto por % de gasto).
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

            {analysis.hasCodLink ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Kpi
                  label="Cobrado COD"
                  value={formatMoney(analysis.collectedRevenue, "PEN")}
                  hint="Órdenes collected (tiendas vinculadas)"
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
                  label="Campañas"
                  value={String(sortedCampaigns.length)}
                  hint={bmFilter === "all" ? "En el período" : `BM ${bmFilter}`}
                />
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
                          % gasto
                        </button>
                      </th>
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
                          {c.advertiserId ? (
                            <span className="mt-0.5 block font-mono text-[10px] font-normal text-[#9a9187]">
                              {c.advertiserId}
                            </span>
                          ) : null}
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

      {isStaff ? (
        <section className="rounded-2xl border border-dashed border-[#ddd5cb] bg-[#faf8f5] p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Opcional · Cobrado COD
          </p>
          <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[#1c1917]">
            Vincular tienda Real Profit
          </h2>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-5 text-[#5c564e]">
            Solo la tienda COD de{" "}
            <span className="font-semibold text-[#1c1917]">este</span> cliente.
            Suma cobrado real al ROAS; el análisis de campañas no lo necesita.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <select
              className="min-w-[260px] flex-1 rounded-xl border border-[#e7e0d8] bg-white px-3.5 py-2.5 text-[13px] outline-none ring-[#ff781f]/30 focus:ring-2"
              value={pickStoreId}
              onChange={(e) => setPickStoreId(e.target.value)}
            >
              {availableStores.length === 0 ? (
                <option value="">
                  {allStores.length === 0
                    ? "Sin tiendas RP en la DB"
                    : "Todas las tiendas ya están vinculadas"}
                </option>
              ) : (
                availableStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.shopDomain ? ` · ${s.shopDomain}` : ""}
                    {s.isActive === false ? " · inactiva" : ""}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => void handleLink()}
              disabled={!pickStoreId || linking || availableStores.length === 0}
              className="inline-flex h-11 items-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {linking ? "Vinculando…" : "Vincular"}
            </button>
          </div>
          {linkedStores.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {linkedStores.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ece7e0] bg-white px-3.5 py-2.5 text-[13px]"
                >
                  <span className="font-medium text-[#1c1917]">
                    {s.name}
                    {s.shopDomain ? (
                      <span className="ml-2 font-mono text-[11px] text-[#8a8177]">
                        {s.shopDomain}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="text-[12px] font-semibold text-[#b45309] underline-offset-2 hover:underline"
                    onClick={() => void handleUnlink(s.id)}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {snapshots.length > 0 ? (
        <section className="space-y-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Tiendas COD vinculadas
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
                  {snap.spendSource === "realprofit"
                    ? "Gasto sync Real Profit"
                    : snap.spendSource === "holistic_tiktok"
                      ? "ROAS con gasto Holistic"
                      : "Sin gasto ads"}
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
