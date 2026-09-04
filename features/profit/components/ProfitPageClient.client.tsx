"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format-money";

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
};

type Snapshot = {
  store: StoreSummary;
  from: string;
  to: string;
  collectedRevenue: number;
  adSpend: number;
  roasCollected: number | null;
  ordersCollected: number;
  campaigns: CampaignRow[];
};

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
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [linkedStores, setLinkedStores] = useState<StoreSummary[]>([]);
  const [allStores, setAllStores] = useState<StoreSummary[]>([]);
  const [pickStoreId, setPickStoreId] = useState("");
  const [linking, setLinking] = useState(false);
  const [realProfitUrl, setRealProfitUrl] = useState(
    "https://www.realprofitcod.com",
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
        linkedStores?: StoreSummary[];
        snapshots?: Snapshot[];
        realProfitUrl?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo cargar Profit.");
      }
      setSnapshots(json.snapshots ?? []);
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
      setNotice("Tienda vinculada. Ya ves cobrado / gasto / ROAS abajo.");
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
              Vista previa · Real Profit COD
            </p>
            <h1 className="mt-1.5 text-[1.55rem] font-bold tracking-[-0.035em] text-[#1c1917] sm:text-[1.75rem]">
              Profit / ROAS · {clienteName}
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-5 text-[#5c564e]">
              Cobrado vs gasto ads por tienda. En campañas el cobrado es{" "}
              <span className="font-semibold text-[#1c1917]">estimado</span>{" "}
              (proporcional al gasto). El producto completo de Real Profit se
              cobra aparte.
            </p>
          </div>
          <a
            href={realProfitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-[#d6cec4] bg-white px-4 text-[13px] font-semibold text-[#1c1917] transition hover:border-[#ff781f]"
          >
            Abrir Real Profit →
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

      {isStaff ? (
        <section className="rounded-2xl border border-dashed border-[#ddd5cb] bg-[#faf8f5] p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
            Staff · Vincular tienda
          </p>
          <h2 className="mt-1 text-[1.05rem] font-bold tracking-[-0.02em] text-[#1c1917]">
            Conectar Real Profit a este cliente
          </h2>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-5 text-[#5c564e]">
            Elegí la tienda Shopify de Real Profit. Incluye tiendas inactivas de
            prueba (ej. wazapp-dev-test).
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
              {linking ? "Vinculando…" : "Vincular al cliente"}
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

      {loading && snapshots.length === 0 ? (
        <p className="text-[13px] text-[#8a8177]">Cargando Profit…</p>
      ) : snapshots.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-5 py-10 text-center">
          <p className="text-[15px] font-semibold text-[#1c1917]">
            Sin tienda vinculada
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-[#5c564e]">
            {isStaff
              ? "Vinculá una tienda Real Profit arriba para ver cobrado, gasto y ROAS."
              : "Pedí a tu gerente que vincule la tienda Shopify de Real Profit a tu cuenta."}
          </p>
        </section>
      ) : (
        snapshots.map((snap) => (
          <section
            key={snap.store.id}
            className="space-y-5 rounded-2xl border border-[#ece7e0] bg-white p-5 shadow-[0_10px_28px_-22px_rgb(28_25_23_/_0.35)] sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                  Tienda
                </p>
                <h2 className="mt-1 text-[1.2rem] font-bold tracking-[-0.02em] text-[#1c1917]">
                  {snap.store.name}
                </h2>
                <p className="mt-0.5 text-[12px] text-[#8a8177]">
                  {snap.from} → {snap.to}
                  {snap.store.shopDomain ? ` · ${snap.store.shopDomain}` : ""}
                </p>
              </div>
              {snap.adSpend === 0 ? (
                <span className="rounded-full bg-[#f3efe9] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6b645c]">
                  Sin gasto ads aún
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Cobrado"
                value={formatMoney(snap.collectedRevenue, snap.store.currency)}
                hint={`${snap.ordersCollected} órdenes collected`}
              />
              <Kpi
                label="Gasto ads"
                value={formatMoney(snap.adSpend, snap.store.currency)}
                hint="Meta / TikTok / Google / manual"
              />
              <Kpi
                label="ROAS cobrado"
                value={
                  snap.roasCollected != null
                    ? `${snap.roasCollected.toFixed(2)}x`
                    : "—"
                }
                hint="Cobrado ÷ gasto"
                accent
              />
              <Kpi
                label="Campañas"
                value={String(snap.campaigns.length)}
                hint="Con gasto en el período"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#8a8177]">
                    Campañas
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#5c564e]">
                    Cobrado y ROAS por campaña = estimado (reparto por % de
                    gasto)
                  </p>
                </div>
              </div>

              {snap.campaigns.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[#e0d8ce] bg-[#faf8f5] px-4 py-6 text-center">
                  <p className="text-[13px] font-semibold text-[#1c1917]">
                    Sin filas de gasto en este período
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] leading-5 text-[#5c564e]">
                    El cobrado de la tienda sí puede verse arriba. El gasto por
                    campaña aparece cuando Real Profit sincroniza Meta/TikTok o
                    carga gasto manual.
                  </p>
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-[#ece7e0]">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-[#faf8f5] text-[10px] uppercase tracking-[0.08em] text-[#9a9187]">
                      <tr>
                        <th className="px-3 py-2.5">Campaña</th>
                        <th className="px-3 py-2.5">Plat.</th>
                        <th className="px-3 py-2.5">Gasto</th>
                        <th className="px-3 py-2.5">% gasto</th>
                        <th className="px-3 py-2.5">Cobrado est.</th>
                        <th className="px-3 py-2.5">ROAS est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.campaigns.map((c) => (
                        <tr
                          key={`${c.platform}-${c.campaignExternalId}`}
                          className="border-t border-[#f0ebe4]"
                        >
                          <td className="px-3 py-2.5 font-medium text-[#1c1917]">
                            {c.campaignName}
                          </td>
                          <td className="px-3 py-2.5 text-[#6b645c]">
                            {c.platform}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {formatMoney(c.spend, snap.store.currency)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {(c.spendShare * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {formatMoney(
                              c.collectedEstimated,
                              snap.store.currency,
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-semibold tabular-nums text-[#c2410c]">
                            {c.roasEstimated != null
                              ? `${c.roasEstimated.toFixed(2)}x`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
