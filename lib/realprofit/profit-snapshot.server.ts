import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import {
  defaultProfitDateRange,
  getRealProfitAdmin,
} from "@/lib/realprofit/db.server";
import {
  loadHolisticTikTokSpendForCliente,
  sliceHolisticSpend,
  type HolisticDailyPoint,
} from "@/lib/realprofit/holistic-spend.server";

export type RpStoreSummary = {
  id: string;
  name: string;
  shopDomain: string | null;
  currency: string;
  isActive: boolean;
};

export type ProfitSpendSource = "realprofit" | "holistic_tiktok" | "none";

export type ProfitCampaignRow = {
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

export type StoreProfitPromo = {
  store: RpStoreSummary;
  from: string;
  to: string;
  collectedRevenue: number;
  adSpend: number;
  roasCollected: number | null;
  ordersCollected: number;
  campaigns: ProfitCampaignRow[];
  spendSource: ProfitSpendSource;
  spendSourceLabel: string;
};

/** Centro de análisis Holistic (reemplaza el job de Gastos en Profit). */
export type ProfitPacingLabel =
  | "acelerando"
  | "normal"
  | "bajo"
  | "parado"
  | "sin_base";

export type ProfitSignal = {
  kind: "concentration" | "pacing" | "silent" | "weak_roas";
  severity: "info" | "warn";
  title: string;
  detail: string;
};

export type ProfitAnalysis = {
  from: string;
  to: string;
  spendToday: number;
  spendYesterday: number;
  /** (hoy − ayer) / ayer · 100; null si ayer = 0 */
  spendTodayDeltaPct: number | null;
  spend7d: number;
  /** Ventana de 7 días previa a la actual (D-13…D-7). */
  spendPrev7d: number;
  spend7dDeltaPct: number | null;
  spend30d: number;
  spendInRange: number;
  /** Gasto del período anterior de igual duración. */
  spendPrevRange: number;
  spendRangeDeltaPct: number | null;
  /** spendHoy ÷ (promedio diario 7d). */
  pacingRatio: number | null;
  pacingLabel: ProfitPacingLabel;
  daysWithActivity: number;
  dailySeries: HolisticDailyPoint[];
  campaigns: ProfitCampaignRow[];
  collectedRevenue: number;
  roasCollected: number | null;
  hasCodLink: boolean;
  /** Último día con gasto en snapshots/gastos (YYYY-MM-DD). */
  dataThroughDate: string | null;
  signals: ProfitSignal[];
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function minYmd(a: string, b: string) {
  return a <= b ? a : b;
}

function maxYmd(a: string, b: string) {
  return a >= b ? a : b;
}

function daysInclusive(from: string, to: string): number {
  if (!from || !to || from > to) return 0;
  const a = new Date(`${from}T12:00:00.000Z`);
  const b = new Date(`${to}T12:00:00.000Z`);
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return round2(((current - previous) / previous) * 100);
}

function resolvePacing(spendToday: number, spend7d: number): {
  pacingRatio: number | null;
  pacingLabel: ProfitPacingLabel;
} {
  if (spendToday <= 0 && spend7d <= 0) {
    return { pacingRatio: null, pacingLabel: "sin_base" };
  }
  if (spendToday <= 0) {
    return { pacingRatio: 0, pacingLabel: "parado" };
  }
  const avg = spend7d / 7;
  if (avg <= 0) {
    return { pacingRatio: null, pacingLabel: "sin_base" };
  }
  const ratio = round2(spendToday / avg);
  if (ratio >= 1.35) return { pacingRatio: ratio, pacingLabel: "acelerando" };
  if (ratio <= 0.5) return { pacingRatio: ratio, pacingLabel: "bajo" };
  return { pacingRatio: ratio, pacingLabel: "normal" };
}

function buildSignals(input: {
  campaigns: ProfitCampaignRow[];
  pacingLabel: ProfitPacingLabel;
  pacingRatio: number | null;
  spendToday: number;
  hasCodLink: boolean;
}): ProfitSignal[] {
  const signals: ProfitSignal[] = [];
  const top = input.campaigns[0];
  if (top && top.spendShare >= 0.4) {
    signals.push({
      kind: "concentration",
      severity: "warn",
      title: `${top.campaignName} concentra ${(top.spendShare * 100).toFixed(0)}%`,
      detail: "Revisá si el resultado justifica ese share del budget.",
    });
  }

  if (input.pacingLabel === "acelerando" && input.pacingRatio != null) {
    signals.push({
      kind: "pacing",
      severity: "warn",
      title: `Pacing alto (${input.pacingRatio.toFixed(2)}× promedio 7d)`,
      detail: "El gasto de hoy va más rápido que la media de la semana.",
    });
  } else if (input.pacingLabel === "parado" && input.spendToday <= 0) {
    signals.push({
      kind: "silent",
      severity: "info",
      title: "Sin gasto hoy",
      detail: "Ninguna campaña registró spend en el día (Lima).",
    });
  } else if (input.pacingLabel === "bajo" && input.pacingRatio != null) {
    signals.push({
      kind: "pacing",
      severity: "info",
      title: `Pacing bajo (${input.pacingRatio.toFixed(2)}× promedio 7d)`,
      detail: "Hoy gastás menos de la mitad del promedio diario 7d.",
    });
  }

  if (input.hasCodLink) {
    const weak = [...input.campaigns]
      .filter((c) => c.spendShare >= 0.08)
      .filter(
        (c) =>
          c.roasEstimated == null ||
          c.roasEstimated < 1 ||
          c.collectedEstimated <= 0,
      )
      .slice(0, 3);
    for (const c of weak) {
      signals.push({
        kind: "weak_roas",
        severity: "warn",
        title: `${c.campaignName}: ROAS est. débil`,
        detail:
          c.roasEstimated != null
            ? `ROAS est. ${c.roasEstimated.toFixed(2)}x · ${(c.spendShare * 100).toFixed(0)}% del gasto`
            : `Sin cobrado estimado · ${(c.spendShare * 100).toFixed(0)}% del gasto`,
      });
    }
  } else {
    const heavy = input.campaigns.filter((c) => c.spendShare >= 0.15).slice(0, 3);
    if (heavy.length >= 2) {
      signals.push({
        kind: "concentration",
        severity: "info",
        title: `${heavy.length} campañas se llevan el budget grande`,
        detail: heavy
          .map((c) => `${c.campaignName} (${(c.spendShare * 100).toFixed(0)}%)`)
          .join(" · "),
      });
    }
  }

  return signals.slice(0, 6);
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
    bm?: string | null;
    advertiserId?: string | null;
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
        bm: c.bm ?? null,
        advertiserId: c.advertiserId ?? null,
      };
    });
}

export async function listActiveRpStores(): Promise<RpStoreSummary[]> {
  const admin = getRealProfitAdmin();
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
  holisticFallback?: {
    adSpend: number;
    byCampaign: Array<{
      campaignExternalId: string;
      campaignName: string;
      platform: string;
      spend: number;
      bm?: string | null;
      advertiserId?: string | null;
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
      bm: string | null;
      advertiserId: string | null;
    }
  >();

  for (const row of spendRows ?? []) {
    const spend = num(row.spend_amount);
    adSpend += spend;
    const cid = String(row.campaign_external_id ?? "").trim();
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
        bm: null,
        advertiserId: null,
      });
    }
  }

  let spendSource: ProfitSpendSource = "realprofit";
  let campaignRows = [...byCampaign.values()];

  if (
    adSpend <= 0 &&
    input.holisticFallback &&
    input.holisticFallback.adSpend > 0
  ) {
    adSpend = input.holisticFallback.adSpend;
    campaignRows = input.holisticFallback.byCampaign.map((c) => ({
      ...c,
      bm: c.bm ?? null,
      advertiserId: c.advertiserId ?? null,
    }));
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

export async function loadClienteProfitPromo(input: {
  hecomClienteId: string;
  from?: string;
  to?: string;
}): Promise<{
  linkedStores: RpStoreSummary[];
  snapshots: StoreProfitPromo[];
  analysis: ProfitAnalysis;
}> {
  const range = {
    from: input.from?.trim() || defaultProfitDateRange().from,
    to: input.to?.trim() || defaultProfitDateRange().to,
  };

  const today = todayYmdInTz();
  const yesterday = shiftYmd(today, -1);
  const from7 = shiftYmd(today, -6);
  const from30 = shiftYmd(today, -29);
  const prev7From = shiftYmd(today, -13);
  const prev7To = shiftYmd(today, -7);
  const rangeLen = Math.max(1, daysInclusive(range.from, range.to));
  const prevRangeTo = shiftYmd(range.from, -1);
  const prevRangeFrom = shiftYmd(prevRangeTo, -(rangeLen - 1));

  const loadFrom = minYmd(
    minYmd(range.from, from30),
    minYmd(prev7From, prevRangeFrom),
  );
  const loadTo = maxYmd(range.to, today);

  const [linkedStores, wide] = await Promise.all([
    getLinkedStoresForCliente(input.hecomClienteId),
    loadHolisticTikTokSpendForCliente({
      hecomClienteId: input.hecomClienteId,
      from: loadFrom,
      to: loadTo,
    }),
  ]);

  const inRange = sliceHolisticSpend(wide, range.from, range.to);
  const spendToday = sliceHolisticSpend(wide, today, today).adSpend;
  const spendYesterday = sliceHolisticSpend(wide, yesterday, yesterday).adSpend;
  const spend7d = sliceHolisticSpend(wide, from7, today).adSpend;
  const spendPrev7d = sliceHolisticSpend(wide, prev7From, prev7To).adSpend;
  const spend30d = sliceHolisticSpend(wide, from30, today).adSpend;
  const spendPrevRange = sliceHolisticSpend(
    wide,
    prevRangeFrom,
    prevRangeTo,
  ).adSpend;

  const holisticFallback =
    inRange.adSpend > 0
      ? {
          adSpend: inRange.adSpend,
          byCampaign: inRange.byCampaign,
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

  const collectedRevenue = round2(
    snapshots.reduce((s, snap) => s + snap.collectedRevenue, 0),
  );
  const spendInRange = round2(inRange.adSpend);
  const campaigns = buildCampaignsFromSpend({
    collectedRevenue,
    adSpend: spendInRange,
    rows: inRange.byCampaign,
  });

  const { pacingRatio, pacingLabel } = resolvePacing(spendToday, spend7d);

  let dataThroughDate: string | null = null;
  for (const row of wide.rows) {
    if (row.spend <= 0) continue;
    if (!dataThroughDate || row.date > dataThroughDate) {
      dataThroughDate = row.date;
    }
  }

  const analysis: ProfitAnalysis = {
    from: range.from,
    to: range.to,
    spendToday: round2(spendToday),
    spendYesterday: round2(spendYesterday),
    spendTodayDeltaPct: pctDelta(spendToday, spendYesterday),
    spend7d: round2(spend7d),
    spendPrev7d: round2(spendPrev7d),
    spend7dDeltaPct: pctDelta(spend7d, spendPrev7d),
    spend30d: round2(spend30d),
    spendInRange,
    spendPrevRange: round2(spendPrevRange),
    spendRangeDeltaPct: pctDelta(spendInRange, spendPrevRange),
    pacingRatio,
    pacingLabel,
    daysWithActivity: inRange.daysWithActivity,
    dailySeries: inRange.dailySeries,
    campaigns,
    collectedRevenue,
    roasCollected:
      spendInRange > 0 && collectedRevenue > 0
        ? round2(collectedRevenue / spendInRange)
        : null,
    hasCodLink: linkedStores.length > 0,
    dataThroughDate,
    signals: buildSignals({
      campaigns,
      pacingLabel,
      pacingRatio,
      spendToday,
      hasCodLink: linkedStores.length > 0,
    }),
  };

  return {
    linkedStores,
    snapshots,
    analysis,
  };
}
