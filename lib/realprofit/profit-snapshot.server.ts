import {
  defaultProfitDateRange,
  getRealProfitAdmin,
} from "@/lib/realprofit/db.server";
import { loadHolisticTikTokSpendForCliente } from "@/lib/realprofit/holistic-spend.server";

export type RpStoreSummary = {
  id: string;
  name: string;
  shopDomain: string | null;
  currency: string;
  isActive: boolean;
};

export type ProfitSpendSource =
  | "realprofit"
  | "holistic_tiktok"
  | "none";

export type ProfitCampaignRow = {
  campaignExternalId: string;
  campaignName: string;
  platform: string;
  spend: number;
  spendShare: number;
  collectedEstimated: number;
  roasEstimated: number | null;
};

export type StoreProfitPromo = {
  store: RpStoreSummary;
  from: string;
  to: string;
  collectedRevenue: number;
  adSpend: number;
  roasCollected: number | null;
  ordersCollected: number;
  campaigns: ProfitCampaignRow[];
  /** De dónde sale el gasto ads (RP sync vs TikTok Holistic). */
  spendSource: ProfitSpendSource;
  spendSourceLabel: string;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function spendSourceLabel(source: ProfitSpendSource): string {
  if (source === "realprofit") return "Gasto Real Profit (rp_ad_spend_daily)";
  if (source === "holistic_tiktok")
    return "Gasto TikTok Holistic (snapshots / gastos)";
  return "Sin gasto ads en el período";
}

function buildCampaignsFromSpend(input: {
  collectedRevenue: number;
  adSpend: number;
  rows: Array<{
    campaignExternalId: string;
    campaignName: string;
    platform: string;
    spend: number;
  }>;
}): ProfitCampaignRow[] {
  const adSpend = input.adSpend;
  return input.rows
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend)
    .map((c) => {
      const spendShare = adSpend > 0 ? c.spend / adSpend : 0;
      const collectedEstimated = input.collectedRevenue * spendShare;
      return {
        campaignExternalId: c.campaignExternalId,
        campaignName: c.campaignName,
        platform: c.platform,
        spend: round2(c.spend),
        spendShare,
        collectedEstimated: round2(collectedEstimated),
        roasEstimated:
          c.spend > 0 ? round2(collectedEstimated / c.spend) : null,
      };
    });
}

export async function listActiveRpStores(): Promise<RpStoreSummary[]> {
  const admin = getRealProfitAdmin();
  // Incluye inactivas: la tienda de prueba RP puede estar is_active=false
  // y igual hace falta vincularla en la promo Holistic.
  const { data, error } = await admin
    .from("rp_stores")
    .select("id, name, shop_domain, currency, is_active")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    shopDomain: row.shop_domain ? String(row.shop_domain) : null,
    currency: String(row.currency ?? "PEN"),
    isActive: Boolean(row.is_active),
  }));
}

export async function getLinkedStoresForCliente(
  hecomClienteId: string,
): Promise<RpStoreSummary[]> {
  const admin = getRealProfitAdmin();
  const { data: links, error } = await admin
    .from("hecom_cliente_rp_stores")
    .select("rp_store_id")
    .eq("hecom_cliente_id", hecomClienteId);

  if (error) throw new Error(error.message);
  const ids = (links ?? [])
    .map((l) => String(l.rp_store_id ?? "").trim())
    .filter(Boolean);
  if (ids.length === 0) return [];

  const { data: stores, error: sErr } = await admin
    .from("rp_stores")
    .select("id, name, shop_domain, currency, is_active")
    .in("id", ids);

  if (sErr) throw new Error(sErr.message);
  return (stores ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    shopDomain: row.shop_domain ? String(row.shop_domain) : null,
    currency: String(row.currency ?? "PEN"),
    isActive: Boolean(row.is_active),
  }));
}

export async function linkStoreToCliente(input: {
  hecomClienteId: string;
  storeId: string;
  userId: string;
}): Promise<void> {
  const admin = getRealProfitAdmin();
  const { data: store, error: sErr } = await admin
    .from("rp_stores")
    .select("id")
    .eq("id", input.storeId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!store) throw new Error("Tienda Real Profit no encontrada.");

  const { error } = await admin.from("hecom_cliente_rp_stores").upsert(
    {
      hecom_cliente_id: input.hecomClienteId,
      rp_store_id: input.storeId,
      created_by: input.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "hecom_cliente_id,rp_store_id" },
  );
  if (error) throw new Error(error.message);
}

export async function unlinkStoreFromCliente(input: {
  hecomClienteId: string;
  storeId: string;
}): Promise<void> {
  const admin = getRealProfitAdmin();
  const { error } = await admin
    .from("hecom_cliente_rp_stores")
    .delete()
    .eq("hecom_cliente_id", input.hecomClienteId)
    .eq("rp_store_id", input.storeId);
  if (error) throw new Error(error.message);
}

/**
 * Promo snapshot: ROAS cobrado real a nivel tienda;
 * cobrado por campaña = estimado proporcional al gasto.
 * Si `rp_ad_spend_daily` está vacío, usa gasto TikTok Holistic (fallback).
 */
export async function loadStoreProfitPromo(input: {
  storeId: string;
  from?: string;
  to?: string;
  /** Fallback Holistic cuando RP no tiene spend sync. */
  holisticFallback?: {
    adSpend: number;
    byCampaign: Array<{
      campaignExternalId: string;
      campaignName: string;
      platform: string;
      spend: number;
    }>;
  } | null;
}): Promise<StoreProfitPromo> {
  const range = {
    from: input.from?.trim() || defaultProfitDateRange().from,
    to: input.to?.trim() || defaultProfitDateRange().to,
  };
  const admin = getRealProfitAdmin();

  const { data: storeRow, error: storeErr } = await admin
    .from("rp_stores")
    .select("id, name, shop_domain, currency, is_active")
    .eq("id", input.storeId)
    .maybeSingle();
  if (storeErr) throw new Error(storeErr.message);
  if (!storeRow) throw new Error("Tienda no encontrada.");

  const store: RpStoreSummary = {
    id: String(storeRow.id),
    name: String(storeRow.name ?? ""),
    shopDomain: storeRow.shop_domain ? String(storeRow.shop_domain) : null,
    currency: String(storeRow.currency ?? "PEN"),
    isActive: Boolean(storeRow.is_active),
  };

  const fromIso = `${range.from}T00:00:00.000Z`;
  const toIso = `${range.to}T23:59:59.999Z`;

  const { data: orderRows, error: oErr } = await admin
    .from("rp_orders")
    .select("collected_amount, status_cod, created_at")
    .eq("store_id", input.storeId)
    .eq("status_cod", "collected")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (oErr) throw new Error(oErr.message);

  const collectedRevenue = (orderRows ?? []).reduce(
    (s, r) => s + num(r.collected_amount),
    0,
  );
  const ordersCollected = orderRows?.length ?? 0;

  const { data: spendRows, error: spErr } = await admin
    .from("rp_ad_spend_daily")
    .select(
      "platform, spend_amount, campaign_external_id, campaign_name, date",
    )
    .eq("store_id", input.storeId)
    .gte("date", range.from)
    .lte("date", range.to);
  if (spErr) throw new Error(spErr.message);

  let adSpend = 0;
  const byCampaign = new Map<
    string,
    {
      campaignExternalId: string;
      campaignName: string;
      platform: string;
      spend: number;
    }
  >();

  for (const row of spendRows ?? []) {
    const spend = num(row.spend_amount);
    adSpend += spend;
    const cid = String(row.campaign_external_id ?? "").trim();
    // Filas de total plataforma (manual) tienen campaign_external_id ''
    const key = cid
      ? `${row.platform}:${cid}`
      : `${row.platform}:__platform_total__`;
    const name =
      cid === ""
        ? `Total ${String(row.platform)} (manual)`
        : String(row.campaign_name ?? cid);
    const prev = byCampaign.get(key);
    if (prev) {
      prev.spend += spend;
    } else {
      byCampaign.set(key, {
        campaignExternalId: cid || "__platform_total__",
        campaignName: name,
        platform: String(row.platform ?? ""),
        spend,
      });
    }
  }

  let spendSource: ProfitSpendSource = "realprofit";
  let campaignRows = [...byCampaign.values()];

  if (adSpend <= 0 && input.holisticFallback && input.holisticFallback.adSpend > 0) {
    adSpend = input.holisticFallback.adSpend;
    campaignRows = input.holisticFallback.byCampaign;
    spendSource = "holistic_tiktok";
  } else if (adSpend <= 0) {
    spendSource = "none";
  }

  const campaigns = buildCampaignsFromSpend({
    collectedRevenue,
    adSpend,
    rows: campaignRows,
  });

  return {
    store,
    from: range.from,
    to: range.to,
    collectedRevenue: round2(collectedRevenue),
    adSpend: round2(adSpend),
    roasCollected: adSpend > 0 ? round2(collectedRevenue / adSpend) : null,
    ordersCollected,
    campaigns,
    spendSource,
    spendSourceLabel: spendSourceLabel(spendSource),
  };
}

function holisticOnlySnapshot(input: {
  from: string;
  to: string;
  holistic: Awaited<ReturnType<typeof loadHolisticTikTokSpendForCliente>>;
}): StoreProfitPromo {
  const adSpend = input.holistic.adSpend;
  const spendSource: ProfitSpendSource =
    adSpend > 0 ? "holistic_tiktok" : "none";
  return {
    store: {
      id: "__holistic_tiktok__",
      name: "Cuentas TikTok (Holistic)",
      shopDomain: null,
      currency: "USD",
      isActive: true,
    },
    from: input.from,
    to: input.to,
    collectedRevenue: 0,
    adSpend: round2(adSpend),
    roasCollected: null,
    ordersCollected: 0,
    campaigns: buildCampaignsFromSpend({
      collectedRevenue: 0,
      adSpend,
      rows: input.holistic.byCampaign,
    }),
    spendSource,
    spendSourceLabel: spendSourceLabel(spendSource),
  };
}

export async function loadClienteProfitPromo(input: {
  hecomClienteId: string;
  from?: string;
  to?: string;
}): Promise<{
  linkedStores: RpStoreSummary[];
  snapshots: StoreProfitPromo[];
  holisticSpend: {
    adSpend: number;
    from: string;
    to: string;
  };
}> {
  const range = {
    from: input.from?.trim() || defaultProfitDateRange().from,
    to: input.to?.trim() || defaultProfitDateRange().to,
  };

  const [linkedStores, holistic] = await Promise.all([
    getLinkedStoresForCliente(input.hecomClienteId),
    loadHolisticTikTokSpendForCliente({
      hecomClienteId: input.hecomClienteId,
      from: range.from,
      to: range.to,
    }),
  ]);

  const holisticFallback =
    holistic.adSpend > 0
      ? {
          adSpend: holistic.adSpend,
          byCampaign: holistic.byCampaign.map((c) => ({
            campaignExternalId: c.campaignExternalId,
            campaignName: c.campaignName,
            platform: c.platform,
            spend: c.spend,
          })),
        }
      : null;

  const snapshots: StoreProfitPromo[] = [];
  for (const store of linkedStores) {
    snapshots.push(
      await loadStoreProfitPromo({
        storeId: store.id,
        from: range.from,
        to: range.to,
        holisticFallback,
      }),
    );
  }

  // Sin tienda vinculada: igual mostramos gasto/campañas TikTok Holistic.
  if (snapshots.length === 0) {
    snapshots.push(
      holisticOnlySnapshot({
        from: range.from,
        to: range.to,
        holistic,
      }),
    );
  }

  return {
    linkedStores,
    snapshots,
    holisticSpend: {
      adSpend: round2(holistic.adSpend),
      from: range.from,
      to: range.to,
    },
  };
}
