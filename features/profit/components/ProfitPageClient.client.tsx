"use client";

import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/lib/format-money";

type StoreSummary = {
  id: string;
  name: string;
  shopDomain: string | null;
  currency: string;
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
        };
        if (sRes.ok && sJson.ok) {
          setAllStores(sJson.stores ?? []);
          setPickStoreId((prev) => prev || sJson.stores?.[0]?.id || "");
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
      setNotice("Tienda vinculada al cliente.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al vincular");
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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white shadow-[0_12px_32px_-20px_rgb(28_25_23_/_0.18)]">
        <div
          aria-hidden
          className="h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
        />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
              Vista previa · Real Profit COD
            </p>
            <h1 className="mt-1 text-[1.35rem] font-bold tracking-[-0.03em] text-[#1c1917]">
              Profit / ROAS · {clienteName}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] font-medium leading-5 text-[#5c564e]">
              Cobrado vs gasto ads (ROAS cobrado) por tienda. En campañas el
              cobrado es <span className="font-semibold">estimado</span>{" "}
              proporcional al gasto. El producto completo de Real Profit COD se
              cobra aparte.
            </p>
          </div>
          <a
            href={realProfitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#e7e0d8] bg-white px-4 text-[13px] font-semibold text-[#1c1917]"
          >
            Abrir Real Profit
          </a>
        </div>
      </section>

      {error ? (
        <div
          className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-950"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      <section className="flex flex-wrap items-end gap-3 rounded-[1rem] border border-[#ece7e0] bg-white p-4">
        <label className="text-[12px] font-medium text-[#5c564e]">
          Desde
          <input
            type="date"
            className="mt-1 block rounded-lg border border-[#e7e0d8] px-3 py-2 text-[13px]"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-[12px] font-medium text-[#5c564e]">
          Hasta
          <input
            type="date"
            className="mt-1 block rounded-lg border border-[#e7e0d8] px-3 py-2 text-[13px]"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-10 items-center rounded-lg bg-[#ff781f] px-4 text-[13px] font-semibold text-white"
        >
          Actualizar
        </button>
      </section>

      {isStaff ? (
        <section className="rounded-[1rem] border border-[#ece7e0] bg-white p-5">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
            Vincular tienda Real Profit
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              className="min-w-[240px] rounded-lg border border-[#e7e0d8] px-3 py-2 text-[13px]"
              value={pickStoreId}
              onChange={(e) => setPickStoreId(e.target.value)}
            >
              {allStores.length === 0 ? (
                <option value="">Sin tiendas RP</option>
              ) : (
                allStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.shopDomain ? ` · ${s.shopDomain}` : ""}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => void handleLink()}
              disabled={!pickStoreId}
              className="inline-flex h-10 items-center rounded-lg bg-[#ff781f] px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              Vincular al cliente
            </button>
          </div>
          {linkedStores.length > 0 ? (
            <ul className="mt-3 space-y-1 text-[12px] text-[#5c564e]">
              {linkedStores.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span>
                    {s.name}
                    {s.shopDomain ? ` · ${s.shopDomain}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-[#b45309] underline"
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

      {loading ? (
        <p className="text-[13px] text-[#8a8177]">Cargando…</p>
      ) : snapshots.length === 0 ? (
        <section className="rounded-[1rem] border border-dashed border-[#e7e0d8] bg-[#faf8f5] px-5 py-8 text-center">
          <p className="text-[15px] font-semibold text-[#1c1917]">
            Sin tienda vinculada
          </p>
          <p className="mt-2 text-[13px] text-[#5c564e]">
            {isStaff
              ? "Vinculá una tienda Real Profit arriba para ver ROAS cobrado."
              : "Pedí a tu gerente que vincule la tienda Shopify de Real Profit."}
          </p>
        </section>
      ) : (
        snapshots.map((snap) => (
          <section
            key={snap.store.id}
            className="space-y-4 rounded-[1rem] border border-[#ece7e0] bg-white p-5"
          >
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
                Tienda
              </p>
              <p className="mt-1 text-[1.1rem] font-bold text-[#1c1917]">
                {snap.store.name}
              </p>
              <p className="text-[12px] text-[#8a8177]">
                {snap.from} → {snap.to}
                {snap.store.shopDomain ? ` · ${snap.store.shopDomain}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: "Cobrado",
                  value: formatMoney(snap.collectedRevenue, snap.store.currency),
                  hint: `${snap.ordersCollected} órdenes collected`,
                },
                {
                  label: "Gasto ads",
                  value: formatMoney(snap.adSpend, snap.store.currency),
                  hint: "Meta / TikTok / Google / manual",
                },
                {
                  label: "ROAS cobrado",
                  value:
                    snap.roasCollected != null
                      ? `${snap.roasCollected.toFixed(2)}x`
                      : "—",
                  hint: "Cobrado ÷ gasto",
                },
                {
                  label: "Campañas",
                  value: String(snap.campaigns.length),
                  hint: "Con gasto en el período",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl border border-[#ece7e0] px-3 py-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a9187]">
                    {card.label}
                  </p>
                  <p className="mt-1 text-[1.15rem] font-bold tabular-nums text-[#1c1917]">
                    {card.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#8a8177]">{card.hint}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
                Campañas
              </p>
              {snap.campaigns.length === 0 ? (
                <p className="mt-2 text-[13px] text-[#8a8177]">
                  Sin gasto de ads en este período (sync Meta/manual en Real
                  Profit).
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="text-[10px] uppercase tracking-[0.08em] text-[#9a9187]">
                      <tr>
                        <th className="py-2 pr-3">Campaña</th>
                        <th className="py-2 pr-3">Plat.</th>
                        <th className="py-2 pr-3">Gasto</th>
                        <th className="py-2 pr-3">% gasto</th>
                        <th className="py-2 pr-3">Cobrado est.</th>
                        <th className="py-2">ROAS est.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snap.campaigns.map((c) => (
                        <tr
                          key={`${c.platform}-${c.campaignExternalId}`}
                          className="border-t border-[#f0ebe4]"
                        >
                          <td className="py-2 pr-3 font-medium text-[#1c1917]">
                            {c.campaignName}
                          </td>
                          <td className="py-2 pr-3 text-[#6b645c]">
                            {c.platform}
                          </td>
                          <td className="py-2 pr-3 tabular-nums">
                            {formatMoney(c.spend, snap.store.currency)}
                          </td>
                          <td className="py-2 pr-3 tabular-nums">
                            {(c.spendShare * 100).toFixed(1)}%
                          </td>
                          <td className="py-2 pr-3 tabular-nums">
                            {formatMoney(
                              c.collectedEstimated,
                              snap.store.currency,
                            )}
                          </td>
                          <td className="py-2 tabular-nums">
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
