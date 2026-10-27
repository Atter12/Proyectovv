import "server-only";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { resolveHolisticUsdPenRate } from "@/lib/payments/fx-rate.server";
import { getRealProfitAdmin } from "@/lib/realprofit/db.server";
import { loadHolisticTikTokSpendForCliente } from "@/lib/realprofit/holistic-spend.server";
import { convertMoney } from "@/lib/realprofit/profit-snapshot.server";

/**
 * Copia el gasto TikTok de Holistic (sin fee) a `rp_ad_spend_daily`
 * para que realprofitcod.com muestre los ads sin carga manual.
 * Se guarda en la moneda de la tienda (Real Profit no convierte al sumar);
 * tiendas en monedas sin TC (MXN, COP…) se saltan.
 * Filas con source 'holistic'; se reemplazan enteras en la ventana.
 * En /profit de Holistic no se duplica: ahí TikTok Holistic manda y las filas
 * tiktok de Real Profit se ignoran.
 */
const SOURCE = "holistic";
const DEFAULT_DAYS = 14;

type RpSpendRow = {
  store_id: string;
  date: string;
  platform: "tiktok";
  spend_amount: string;
  currency: string;
  campaign_external_id: string;
  campaign_name: string;
  source: string;
};

export type SyncTikTokToRpResult = {
  from: string;
  to: string;
  clientes: number;
  stores: number;
  rows: number;
  errors: Array<{ hecomClienteId: string; error: string }>;
};

export async function syncHolisticTikTokToRealProfit(
  input: { days?: number } = {},
): Promise<SyncTikTokToRpResult> {
  const days = Math.min(Math.max(input.days ?? DEFAULT_DAYS, 1), 60);
  const to = todayYmdInTz("America/Lima");
  const from = shiftYmd(to, -(days - 1));
  const admin = getRealProfitAdmin();
  const result: SyncTikTokToRpResult = { from, to, clientes: 0, stores: 0, rows: 0, errors: [] };

  const { data: links, error } = await admin
    .from("hecom_cliente_rp_stores")
    .select("hecom_cliente_id, rp_store_id");
  if (error) throw new Error(error.message);

  const storeIds = [...new Set((links ?? []).map((l) => String(l.rp_store_id ?? "").trim()))]
    .filter(Boolean);
  const currencyByStore = new Map<string, string>();
  if (storeIds.length > 0) {
    const { data: storeRows, error: sErr } = await admin
      .from("rp_stores")
      .select("id, currency")
      .in("id", storeIds);
    if (sErr) throw new Error(sErr.message);
    for (const s of storeRows ?? []) {
      currencyByStore.set(String(s.id), String(s.currency ?? "PEN"));
    }
  }
  const { usdPen } = await resolveHolisticUsdPenRate();

  const storesByCliente = new Map<string, string[]>();
  for (const l of links ?? []) {
    const cid = String(l.hecom_cliente_id ?? "").trim();
    const sid = String(l.rp_store_id ?? "").trim();
    if (!cid || !currencyByStore.has(sid)) continue;
    storesByCliente.set(cid, [...(storesByCliente.get(cid) ?? []), sid]);
  }

  for (const [hecomClienteId, clienteStores] of storesByCliente) {
    result.clientes += 1;
    try {
      const bundle = await loadHolisticTikTokSpendForCliente({ hecomClienteId, from, to });

      // Un registro por día × campaña (la clave única de rp_ad_spend_daily).
      const byKey = new Map<string, { date: string; cid: string; name: string; spend: number }>();
      for (const r of bundle.rows) {
        const cid = (r.campaignId ?? "").trim() || `name:${r.campaignName}`;
        const key = `${r.date}|${cid}`;
        const prev = byKey.get(key);
        if (prev) prev.spend += r.spend;
        else byKey.set(key, { date: r.date, cid, name: r.campaignName, spend: r.spend });
      }

      for (const storeId of clienteStores) {
        const currency = currencyByStore.get(storeId)!;
        const rate = convertMoney(1, "USD", currency, usdPen);
        if (rate == null) continue;
        const rows: RpSpendRow[] = [...byKey.values()]
          .filter((v) => v.spend > 0)
          .map((v) => ({
            store_id: storeId,
            date: v.date,
            platform: "tiktok",
            spend_amount: (Math.round(v.spend * rate * 100) / 100).toFixed(2),
            currency,
            campaign_external_id: v.cid,
            campaign_name: v.name,
            source: SOURCE,
          }));

        const { error: delErr } = await admin
          .from("rp_ad_spend_daily")
          .delete()
          .eq("store_id", storeId)
          .eq("platform", "tiktok")
          .eq("source", SOURCE)
          .gte("date", from)
          .lte("date", to);
        if (delErr) throw new Error(delErr.message);

        if (rows.length > 0) {
          const { error: upErr } = await admin
            .from("rp_ad_spend_daily")
            .upsert(rows, { onConflict: "store_id,date,platform,campaign_external_id" });
          if (upErr) throw new Error(upErr.message);
        }
        result.stores += 1;
        result.rows += rows.length;
      }
    } catch (e) {
      result.errors.push({
        hecomClienteId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
