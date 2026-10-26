import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { getHecomClienteAdAccountsOverview } from "@/lib/hecom/ad-accounts.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { fetchCampaignPerformanceForAdvertisers } from "@/lib/integrations/tiktok/campaign-performance.server";
import { fetchCampaignPerformancePreferStored } from "@/lib/radar/stored-campaign-perf.server";
import { resolveFeePercentFromHecomCliente } from "@/lib/payments/resolve-hecom-deposit-fee.server";
import { resolveHolisticUsdPenRate } from "@/lib/payments/fx-rate.server";
import {
  defaultProfitDateRange,
  getRealProfitAdmin,
} from "@/lib/realprofit/db.server";
import {
  loadHolisticTikTokSpendForCliente,
  sliceHolisticSpend,
  type HolisticDailyPoint,
} from "@/lib/realprofit/holistic-spend.server";
import { getRealProfitSubscription } from "@/lib/realprofit/subscription.server";
import { buildBurnRateSignalsForCliente } from "@/lib/realprofit/burn-rate-signals.server";
import { loadProfitStaffOps } from "@/lib/realprofit/staff-ops-profit.server";
import type { ProfitStaffOps } from "@/lib/realprofit/staff-ops-profit.server";

export type { ProfitStaffOps };

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
  | "mixed"
  | "none";

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
  impressions: number | null;
  clicks: number | null;
  /** CTR % */
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number | null;
  costPerConversion: number | null;
  /** true si vino overlay del report TikTok live */
  hasTikTokPerf: boolean;
  /** Último día con gasto Holistic en el rango (YYYY-MM-DD). */
  lastStatDate: string | null;
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
  kind:
    | "burn_rate"
    | "concentration"
    | "pacing"
    | "silent"
    | "weak_roas"
    | "low_ctr";
  severity: "info" | "warn" | "critical";
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
  /** Órdenes collected en tiendas vinculadas (rango). */
  ordersCollected: number;
  /** Gasto ÷ órdenes collected. */
  cpaCollected: number | null;
  /** Cobrado ÷ órdenes. */
  avgOrderCollected: number | null;
  /** Fee Holistic % (depósito). */
  feePercent: number;
  /** Gasto × (1 + fee/100) — cash aproximado para fondear ese spend. */
  effectiveAdSpend: number;
  /** Cobrado ÷ effectiveAdSpend. */
  roasEffective: number | null;
  /** 1 + fee/100 — ROAS mínimo solo para cubrir ads+fee (sin COGS producto). */
  breakEvenRoas: number;
  /** true si roasEffective >= breakEvenRoas */
  aboveBreakEven: boolean | null;
  /** Último día con gasto en snapshots/gastos (YYYY-MM-DD). */
  dataThroughDate: string | null;
  signals: ProfitSignal[];
  perf: {
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

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Convierte entre PEN y USD con el TC Holistic. null = par sin TC
 * (MXN, COP…): mejor excluir que mezclar monedas en el ROAS.
 */
function convertMoney(
  amount: number,
  from: string,
  to: string,
  usdPen: number,
): number | null {
  const a = from.trim().toUpperCase();
  const b = to.trim().toUpperCase();
  if (a === b) return amount;
  if (!(usdPen > 0)) return null;
  if (a === "USD" && b === "PEN") return amount * usdPen;
  if (a === "PEN" && b === "USD") return amount / usdPen;
  return null;
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
      detail: "Revisa si el resultado justifica ese share del budget.",
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
      detail: "Hoy gastas menos de la mitad del promedio diario 7d.",
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

  const lowCtr = [...input.campaigns]
    .filter((c) => c.hasTikTokPerf && c.ctr != null && c.spendShare >= 0.05)
    .filter((c) => (c.ctr ?? 0) < 0.5)
    .slice(0, 2);
    for (const c of lowCtr) {
    signals.push({
      kind: "low_ctr",
      severity: "warn",
      title: `${c.campaignName}: CTR bajo`,
      detail: `CTR ${c.ctr!.toFixed(2)}% · CPC ${c.cpc != null ? `$${c.cpc.toFixed(2)}` : "—"} — revisa creativo/oferta.`,
    });
  }

  return signals.slice(0, 8);
}

type PerfMergeRow = {
  campaignExternalId: string;
  campaignName: string;
  platform: string;
  spend: number;
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

function mergeCampaignsWithTikTokPerf(input: {
  holisticCampaigns: Array<{
    campaignExternalId: string;
    campaignName: string;
    platform: string;
    spend: number;
    bm: string | null;
    advertiserId: string | null;
    lastStatDate?: string | null;
  }>;
  perfRows: Awaited<
    ReturnType<typeof fetchCampaignPerformanceForAdvertisers>
  >["rows"];
}): PerfMergeRow[] {
  const perfById = new Map<
    string,
    Awaited<
      ReturnType<typeof fetchCampaignPerformanceForAdvertisers>
    >["rows"][number]
  >();
  for (const row of input.perfRows) {
    const prev = perfById.get(row.campaignId);
    if (!prev) {
      perfById.set(row.campaignId, { ...row });
      continue;
    }
    // Misma campaña en 2 advertisers (raro): sumar delivery.
    prev.spend = round2(prev.spend + row.spend);
    prev.impressions += row.impressions;
    prev.clicks += row.clicks;
    if (row.conversions != null) {
      prev.conversions = (prev.conversions ?? 0) + row.conversions;
    }
    prev.ctr =
      prev.impressions > 0
        ? round2((prev.clicks / prev.impressions) * 100)
        : prev.ctr;
    prev.cpc = prev.clicks > 0 ? round2(prev.spend / prev.clicks) : prev.cpc;
    prev.cpm =
      prev.impressions > 0
        ? round2((prev.spend / prev.impressions) * 1000)
        : prev.cpm;
  }

  const used = new Set<string>();
  // El reporte TikTok a veces trae el id en lugar del nombre: se prefiere el
  // nombre real que guardan los snapshots.
  const isIdLike = (value: string | null | undefined) => /^\d{8,}$/.test(String(value ?? "").trim());
  const pickName = (fromPerf: string | null | undefined, fromHolistic: string) =>
    fromPerf && !isIdLike(fromPerf) ? fromPerf : fromHolistic || String(fromPerf ?? "");
  const merged: PerfMergeRow[] = input.holisticCampaigns.map((c) => {
    const cid = c.campaignExternalId.startsWith("name:")
      ? ""
      : c.campaignExternalId;
    const perf = cid ? perfById.get(cid) : undefined;
    if (perf) used.add(perf.campaignId);
    return {
      campaignExternalId: c.campaignExternalId,
      campaignName: pickName(perf?.campaignName, c.campaignName),
      platform: c.platform,
      spend: c.spend,
      bm: c.bm,
      advertiserId: c.advertiserId ?? perf?.advertiserId ?? null,
      impressions: perf?.impressions ?? null,
      clicks: perf?.clicks ?? null,
      ctr: perf?.ctr ?? null,
      cpc: perf?.cpc ?? null,
      cpm: perf?.cpm ?? null,
      conversions: perf?.conversions ?? null,
      costPerConversion: perf?.costPerConversion ?? null,
      hasTikTokPerf: Boolean(perf),
      lastStatDate: c.lastStatDate ?? null,
    };
  });

  // Campañas TikTok con spend que no estaban en Holistic snapshots.
  for (const perf of perfById.values()) {
    if (used.has(perf.campaignId) || perf.spend <= 0) continue;
    merged.push({
      campaignExternalId: perf.campaignId,
      campaignName: perf.campaignName,
      platform: "tiktok",
      spend: perf.spend,
      bm: null,
      advertiserId: perf.advertiserId,
      impressions: perf.impressions,
      clicks: perf.clicks,
      ctr: perf.ctr,
      cpc: perf.cpc,
      cpm: perf.cpm,
      conversions: perf.conversions,
      costPerConversion: perf.costPerConversion,
      hasTikTokPerf: true,
      lastStatDate: null,
    });
  }

  return merged;
}

function summarizePerf(
  campaigns: ProfitCampaignRow[],
  meta: {
    advertisersQueried: number;
    advertisersOk: number;
    fetchedAt: string | null;
    error: string | null;
  },
): ProfitAnalysis["perf"] {
  const withPerf = campaigns.filter((c) => c.hasTikTokPerf);
  const impressions = withPerf.reduce((s, c) => s + (c.impressions ?? 0), 0);
  const clicks = withPerf.reduce((s, c) => s + (c.clicks ?? 0), 0);
  const conversions = withPerf.reduce((s, c) => s + (c.conversions ?? 0), 0);
  const spend = withPerf.reduce((s, c) => s + c.spend, 0);
  return {
    available: withPerf.length > 0,
    impressions,
    clicks,
    conversions,
    avgCtr: impressions > 0 ? round2((clicks / impressions) * 100) : null,
    avgCpc: clicks > 0 ? round2(spend / clicks) : null,
    avgCpm: impressions > 0 ? round2((spend / impressions) * 1000) : null,
    advertisersQueried: meta.advertisersQueried,
    advertisersOk: meta.advertisersOk,
    fetchedAt: meta.fetchedAt,
    error: meta.error,
  };
}

function spendSourceLabel(source: ProfitSpendSource): string {
  if (source === "realprofit") return "Gasto Real Profit (rp_ad_spend_daily)";
  if (source === "holistic_tiktok")
    return "Gasto TikTok Holistic (snapshots / gastos)";
  if (source === "mixed")
    return "Gasto TikTok Holistic + otras plataformas de Real Profit";
  return "Sin gasto ads en el período";
}

function buildCampaignsFromSpend(input: {
  collectedRevenue: number;
  /** Cobrado en la moneda del gasto, para el ROAS (default: collectedRevenue). */
  collectedInSpendCurrency?: number;
  adSpend: number;
  rows: Array<{
    campaignExternalId: string;
    campaignName: string;
    platform: string;
    spend: number;
    bm?: string | null;
    advertiserId?: string | null;
    impressions?: number | null;
    clicks?: number | null;
    ctr?: number | null;
    cpc?: number | null;
    cpm?: number | null;
    conversions?: number | null;
    costPerConversion?: number | null;
    hasTikTokPerf?: boolean;
    lastStatDate?: string | null;
  }>;
}): ProfitCampaignRow[] {
  const adSpend = input.adSpend;
  const collectedForRoas =
    input.collectedInSpendCurrency ?? input.collectedRevenue;
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
          c.spend > 0
            ? round2((collectedForRoas * spendShare) / c.spend)
            : null,
        bm: c.bm ?? null,
        advertiserId: c.advertiserId ?? null,
        impressions: c.impressions ?? null,
        clicks: c.clicks ?? null,
        ctr: c.ctr ?? null,
        cpc: c.cpc ?? null,
        cpm: c.cpm ?? null,
        conversions: c.conversions ?? null,
        costPerConversion: c.costPerConversion ?? null,
        hasTikTokPerf: Boolean(c.hasTikTokPerf),
        lastStatDate: c.lastStatDate ?? null,
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
  userId?: string | null;
}): Promise<void> {
  const admin = getRealProfitAdmin();
  const { data: store, error: sErr } = await admin
    .from("rp_stores")
    .select("id")
    .eq("id", input.storeId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!store) throw new Error("Tienda Real Profit no encontrada.");

  const createdBy =
    input.userId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.userId,
    )
      ? input.userId
      : null;

  const { error } = await admin.from("hecom_cliente_rp_stores").upsert(
    {
      hecom_cliente_id: input.hecomClienteId,
      rp_store_id: input.storeId,
      created_by: createdBy,
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

function normalizeShopDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

export { normalizeShopDomain };

/**
 * Dominio Shopify del último pago COD (metadata) o de la sub.
 */
export async function resolveShopDomainFromCodPayment(
  hecomClienteId: string,
): Promise<string | null> {
  const admin = getRealProfitAdmin();
  const sub = await getRealProfitSubscription(hecomClienteId);
  const intentId = sub.lastPaymentIntentId;
  if (!intentId) return null;

  const { data, error } = await admin
    .from("payment_intents")
    .select("metadata")
    .eq("id", intentId)
    .maybeSingle<{ metadata: Record<string, unknown> | null }>();
  if (error) throw new Error(error.message);

  const raw = data?.metadata?.shop_domain;
  if (typeof raw !== "string" || !raw.trim()) return null;
  return normalizeShopDomain(raw);
}

/**
 * Vincula la tienda Real Profit ya instalada al cliente Hecom.
 * Prioridad: shop_domain del pago → si no, no inventa links.
 */
export async function autoLinkRpStoreForCliente(input: {
  hecomClienteId: string;
  shopDomain?: string | null;
  userId?: string | null;
}): Promise<{ linkedStoreId: string | null; alreadyLinked: boolean }> {
  const existing = await getLinkedStoresForCliente(input.hecomClienteId);
  if (existing.length > 0) {
    return { linkedStoreId: existing[0]!.id, alreadyLinked: true };
  }

  const domain = input.shopDomain ? normalizeShopDomain(input.shopDomain) : "";
  if (!domain) {
    return { linkedStoreId: null, alreadyLinked: false };
  }

  const candidates = Array.from(
    new Set([
      domain,
      domain.endsWith(".myshopify.com")
        ? domain
        : `${domain.replace(/\.myshopify\.com$/i, "")}.myshopify.com`,
    ]),
  );

  const admin = getRealProfitAdmin();
  const { data: stores, error } = await admin
    .from("rp_stores")
    .select("id, shop_domain, is_active")
    .in("shop_domain", candidates)
    .limit(5);
  if (error) throw new Error(error.message);

  const store =
    (stores ?? []).find((s) => s.is_active) ?? (stores ?? [])[0] ?? null;
  if (!store?.id) {
    return { linkedStoreId: null, alreadyLinked: false };
  }

  await linkStoreToCliente({
    hecomClienteId: input.hecomClienteId,
    storeId: String(store.id),
    userId: input.userId,
  });
  return { linkedStoreId: String(store.id), alreadyLinked: false };
}

/**
 * Promo snapshot: ROAS cobrado real a nivel tienda;
 * cobrado por campaña = estimado proporcional al gasto.
 * Gasto = TikTok Holistic (USD, fuente de verdad TikTok) + Meta/Google/manual
 * de `rp_ad_spend_daily`, todo convertido a la moneda de la tienda.
 */
export async function loadStoreProfitPromo(
  input: Parameters<typeof loadStoreProfitInternal>[0],
): Promise<StoreProfitPromo> {
  return (await loadStoreProfitInternal(input)).promo;
}

type StoreProfitInternal = {
  promo: StoreProfitPromo;
  /** Cobrado convertido para el resumen del cliente (null = moneda sin TC). */
  collectedUsd: number | null;
  collectedPen: number | null;
  /** Gasto de Real Profit en USD que no duplica TikTok Holistic (Meta, Google, manual). */
  otherCampaignsUsd: Array<{
    campaignExternalId: string;
    campaignName: string;
    platform: string;
    spend: number;
    lastStatDate: string | null;
  }>;
};

async function loadStoreProfitInternal(input: {
  storeId: string;
  from?: string;
  to?: string;
  /** TC USD→PEN; si falta se resuelve aquí. */
  usdPen?: number;
  /** Gasto TikTok Holistic del cliente, en USD. */
  holisticTikTok?: {
    adSpend: number;
    byCampaign: Array<{
      campaignExternalId: string;
      campaignName: string;
      platform: string;
      spend: number;
      bm?: string | null;
      advertiserId?: string | null;
      lastStatDate?: string | null;
    }>;
  } | null;
}): Promise<StoreProfitInternal> {
  const range = {
    from: input.from?.trim() || defaultProfitDateRange().from,
    to: input.to?.trim() || defaultProfitDateRange().to,
  };
  const admin = getRealProfitAdmin();
  const usdPen =
    input.usdPen ?? (await resolveHolisticUsdPenRate()).usdPen;

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
    .select("collected_amount, currency, status_cod, created_at")
    .eq("store_id", input.storeId)
    .eq("status_cod", "collected")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (oErr) throw new Error(oErr.message);

  const collectedRevenue = (orderRows ?? []).reduce(
    (s, r) =>
      s +
      (convertMoney(
        num(r.collected_amount),
        String(r.currency ?? store.currency),
        store.currency,
        usdPen,
      ) ?? 0),
    0,
  );
  const ordersCollected = orderRows?.length ?? 0;

  const { data: spendRows, error: spErr } = await admin
    .from("rp_ad_spend_daily")
    .select(
      "platform, spend_amount, currency, campaign_external_id, campaign_name, date",
    )
    .eq("store_id", input.storeId)
    .gte("date", range.from)
    .lte("date", range.to);
  if (spErr) throw new Error(spErr.message);

  const holisticTikTokSpend = Math.max(0, input.holisticTikTok?.adSpend ?? 0);
  const holisticToStore = convertMoney(1, "USD", store.currency, usdPen);
  // TikTok Holistic manda; filas TikTok de Real Profit solo si no hay Holistic.
  const useHolisticTikTok = holisticTikTokSpend > 0 && holisticToStore != null;

  let adSpend = 0;
  let realProfitSpend = 0;
  const otherCampaignsUsd = new Map<
    string,
    StoreProfitInternal["otherCampaignsUsd"][number]
  >();
  const byCampaign = new Map<
    string,
    {
      campaignExternalId: string;
      campaignName: string;
      platform: string;
      spend: number;
      bm: string | null;
      advertiserId: string | null;
      lastStatDate: string | null;
    }
  >();

  for (const row of spendRows ?? []) {
    const platform = String(row.platform ?? "");
    if (useHolisticTikTok && platform === "tiktok") continue;
    const rowCurrency = String(row.currency ?? store.currency);
    const spend = convertMoney(
      num(row.spend_amount),
      rowCurrency,
      store.currency,
      usdPen,
    );
    // Moneda sin TC (ni PEN ni USD): no se mezcla con el resto.
    if (spend == null || spend <= 0) continue;
    adSpend += spend;
    realProfitSpend += spend;
    const cid = String(row.campaign_external_id ?? "").trim();
    const key = cid
      ? `${row.platform}:${cid}`
      : `${row.platform}:__platform_total__`;
    const name =
      cid === ""
        ? `Total ${String(row.platform)} (manual)`
        : String(row.campaign_name ?? cid);
    const day = String(row.date ?? "").slice(0, 10) || null;
    const prev = byCampaign.get(key);
    if (prev) {
      prev.spend += spend;
      if (day && (!prev.lastStatDate || day > prev.lastStatDate)) {
        prev.lastStatDate = day;
      }
    } else {
      byCampaign.set(key, {
        campaignExternalId: cid || "__platform_total__",
        campaignName: name,
        platform: String(row.platform ?? ""),
        spend,
        bm: null,
        advertiserId: null,
        lastStatDate: day,
      });
    }

    const spendUsd = convertMoney(spend, store.currency, "USD", usdPen);
    // Filas TikTok solo llegan aquí si no hay TikTok Holistic: también suman.
    if (spendUsd != null) {
      const prevUsd = otherCampaignsUsd.get(key);
      if (prevUsd) {
        prevUsd.spend += spendUsd;
        if (day && (!prevUsd.lastStatDate || day > prevUsd.lastStatDate)) {
          prevUsd.lastStatDate = day;
        }
      } else {
        otherCampaignsUsd.set(key, {
          campaignExternalId: cid || "__platform_total__",
          campaignName: name,
          platform,
          spend: spendUsd,
          lastStatDate: day,
        });
      }
    }
  }

  const campaignRows = [...byCampaign.values()];
  if (useHolisticTikTok && input.holisticTikTok) {
    adSpend += holisticTikTokSpend * holisticToStore!;
    for (const c of input.holisticTikTok.byCampaign) {
      campaignRows.push({
        ...c,
        spend: c.spend * holisticToStore!,
        bm: c.bm ?? null,
        advertiserId: c.advertiserId ?? null,
        lastStatDate: c.lastStatDate ?? null,
      });
    }
  }

  const spendSource: ProfitSpendSource =
    useHolisticTikTok && realProfitSpend > 0
      ? "mixed"
      : useHolisticTikTok
        ? "holistic_tiktok"
        : realProfitSpend > 0
          ? "realprofit"
          : "none";

  const campaigns = buildCampaignsFromSpend({
    collectedRevenue,
    adSpend,
    rows: campaignRows,
  });

  const collectedUsd = convertMoney(
    collectedRevenue,
    store.currency,
    "USD",
    usdPen,
  );
  const collectedPen = convertMoney(
    collectedRevenue,
    store.currency,
    "PEN",
    usdPen,
  );

  return {
    promo: {
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
    },
    collectedUsd,
    collectedPen,
    otherCampaignsUsd: [...otherCampaignsUsd.values()],
  };
}

export async function loadClienteProfitPromo(input: {
  hecomClienteId: string;
  from?: string;
  to?: string;
  /** false = vista cliente: no calcula score ni crédito (ahorra un reporte TikTok). */
  includeStaffOps?: boolean;
}): Promise<{
  linkedStores: RpStoreSummary[];
  snapshots: StoreProfitPromo[];
  analysis: ProfitAnalysis;
  staffOps: ProfitStaffOps | null;
}> {
  const includeStaffOps = input.includeStaffOps ?? true;
  const range = {
    from: input.from?.trim() || defaultProfitDateRange().from,
    to: input.to?.trim() || defaultProfitDateRange().to,
  };

  const today = todayYmdInTz();
  const yesterday = shiftYmd(today, -1);
  const from7 = shiftYmd(today, -6);
  const from30 = shiftYmd(today, -29);
  const from90 = shiftYmd(today, -89);
  const prev7From = shiftYmd(today, -13);
  const prev7To = shiftYmd(today, -7);
  const rangeLen = Math.max(1, daysInclusive(range.from, range.to));
  const prevRangeTo = shiftYmd(range.from, -1);
  const prevRangeFrom = shiftYmd(prevRangeTo, -(rangeLen - 1));

  const loadFrom = minYmd(
    minYmd(range.from, from90),
    minYmd(prev7From, prevRangeFrom),
  );
  const loadTo = maxYmd(range.to, today);

  const [linkedStores, wide, overview, hecomCliente, fx] = await Promise.all([
    getLinkedStoresForCliente(input.hecomClienteId),
    loadHolisticTikTokSpendForCliente({
      hecomClienteId: input.hecomClienteId,
      from: loadFrom,
      to: loadTo,
    }),
    getHecomClienteAdAccountsOverview(input.hecomClienteId, "fast").catch(
      () => null,
    ),
    getHecomCliente(input.hecomClienteId).catch(() => null),
    resolveHolisticUsdPenRate(),
  ]);
  const usdPen = fx.usdPen;

  const feeResolved = resolveFeePercentFromHecomCliente({
    tiktokDefaultFee: hecomCliente?.tiktokDefaultFee ?? null,
    accountFees: (hecomCliente?.tiktokAccounts ?? []).map((a) => a.fee),
  });
  const feePercent = feeResolved.feePercent;

  const advertiserIds = (overview?.accounts ?? [])
    .map((a) => (a.externalAccountId ?? "").trim())
    .filter(Boolean);

  // Desde radar_ad_daily si los procesos diarios cubren el rango; si no, en vivo.
  const perfPromise = fetchCampaignPerformancePreferStored({
    advertiserIds,
    from: range.from,
    to: range.to,
    maxAdvertisers: 12,
  });

  const uiCoversScoreWindow = range.from === from30 && range.to === today;
  const scorePerfPromise = !includeStaffOps
    ? null
    : uiCoversScoreWindow
      ? perfPromise
      : fetchCampaignPerformancePreferStored({
          advertiserIds,
          from: from30,
          to: today,
          maxAdvertisers: 12,
        });

  // No bloquear Profit más de ~14s por reportes TikTok.
  const emptyPerf = {
    rows: [] as Awaited<
      ReturnType<typeof fetchCampaignPerformanceForAdvertisers>
    >["rows"],
    fetchedAt: new Date().toISOString(),
    advertisersQueried: advertiserIds.length,
    advertisersOk: 0,
    error: "Timeout consultando performance TikTok.",
  };
  type PerfResult = Awaited<ReturnType<typeof fetchCampaignPerformanceForAdvertisers>>;
  const withTimeout = (p: Promise<PerfResult>) =>
    Promise.race([
      p,
      new Promise<PerfResult>((resolve) =>
        setTimeout(() => resolve({ ...emptyPerf }), 14_000),
      ),
    ]);

  const inRange = sliceHolisticSpend(wide, range.from, range.to);
  const spendToday = sliceHolisticSpend(wide, today, today).adSpend;
  const holisticTikTok =
    inRange.adSpend > 0
      ? {
          adSpend: inRange.adSpend,
          byCampaign: inRange.byCampaign,
        }
      : null;

  // Tiendas COD y señales de quema corren mientras TikTok responde (antes iban en fila).
  const [perf, scorePerf, storeResults, burnSignals] = await Promise.all([
    withTimeout(perfPromise),
    scorePerfPromise ? withTimeout(scorePerfPromise) : Promise.resolve(null),
    Promise.all(
      linkedStores.map((store) =>
        loadStoreProfitInternal({
          storeId: store.id,
          from: range.from,
          to: range.to,
          usdPen,
          holisticTikTok,
        }),
      ),
    ),
    buildBurnRateSignalsForCliente({
      hecomClienteId: input.hecomClienteId,
      spendTodayUsd: spendToday,
    }),
  ]);

  const spendYesterday = sliceHolisticSpend(wide, yesterday, yesterday).adSpend;
  const spend7d = sliceHolisticSpend(wide, from7, today).adSpend;
  const spendPrev7d = sliceHolisticSpend(wide, prev7From, prev7To).adSpend;
  const spend30d = sliceHolisticSpend(wide, from30, today).adSpend;
  const spend90d = sliceHolisticSpend(wide, from90, today).adSpend;
  const spendPrevRange = sliceHolisticSpend(
    wide,
    prevRangeFrom,
    prevRangeTo,
  ).adSpend;

  const snapshots = storeResults.map((r) => r.promo);
  // Resumen: cobrado se muestra en PEN; gasto y ratios van en USD.
  const collectedRevenue = round2(
    storeResults.reduce((s, r) => s + (r.collectedPen ?? 0), 0),
  );
  const collectedUsd = storeResults.reduce(
    (s, r) => s + (r.collectedUsd ?? 0),
    0,
  );
  const ordersCollected = snapshots.reduce(
    (s, snap) => s + snap.ordersCollected,
    0,
  );

  // Meta / Google / manual de Real Profit (USD), sumados al TikTok Holistic.
  const otherByKey = new Map<string, PerfMergeRow>();
  for (const row of storeResults.flatMap((r) => r.otherCampaignsUsd)) {
    const key = `${row.platform}:${row.campaignExternalId}`;
    const prev = otherByKey.get(key);
    if (prev) {
      prev.spend += row.spend;
      if (
        row.lastStatDate &&
        (!prev.lastStatDate || row.lastStatDate > prev.lastStatDate)
      ) {
        prev.lastStatDate = row.lastStatDate;
      }
      continue;
    }
    otherByKey.set(key, {
      ...row,
      bm: null,
      advertiserId: null,
      impressions: null,
      clicks: null,
      ctr: null,
      cpc: null,
      cpm: null,
      conversions: null,
      costPerConversion: null,
      hasTikTokPerf: false,
    });
  }
  const otherRows = [...otherByKey.values()];
  const otherAdSpend = round2(otherRows.reduce((s, r) => s + r.spend, 0));

  const mergedRows = [
    ...mergeCampaignsWithTikTokPerf({
      holisticCampaigns: inRange.byCampaign,
      perfRows: perf.rows,
    }),
    ...otherRows,
  ];

  // Si Holistic no tenía campañas pero TikTok sí, el spend del ranking
  // usa TikTok; los KPIs de consumo siguen siendo Holistic.
  const spendForShare =
    mergedRows.reduce((s, r) => s + r.spend, 0) ||
    round2(inRange.adSpend + otherAdSpend);
  const spendInRange = round2(inRange.adSpend);
  const totalAdSpend = round2(spendInRange + otherAdSpend);
  const campaigns = buildCampaignsFromSpend({
    collectedRevenue,
    collectedInSpendCurrency: collectedUsd,
    adSpend: spendForShare,
    rows: mergedRows,
  });

  const { pacingRatio, pacingLabel } = resolvePacing(spendToday, spend7d);

  let dataThroughDate: string | null = null;
  for (const row of wide.rows) {
    if (row.spend <= 0) continue;
    if (!dataThroughDate || row.date > dataThroughDate) {
      dataThroughDate = row.date;
    }
  }

  // El fee Holistic solo aplica al gasto TikTok que se fondea por Holistic.
  const effectiveAdSpend = round2(
    spendInRange * (1 + feePercent / 100) + otherAdSpend,
  );
  const breakEvenRoas =
    totalAdSpend > 0
      ? round2(effectiveAdSpend / totalAdSpend)
      : round2(1 + feePercent / 100);
  const cpaCollected =
    ordersCollected > 0 && totalAdSpend > 0
      ? round2(totalAdSpend / ordersCollected)
      : null;
  // En PEN, como collectedRevenue.
  const avgOrderCollected =
    ordersCollected > 0 && collectedRevenue > 0
      ? round2(collectedRevenue / ordersCollected)
      : null;
  const roasEffective =
    effectiveAdSpend > 0 && collectedUsd > 0
      ? round2(collectedUsd / effectiveAdSpend)
      : null;
  const aboveBreakEven =
    roasEffective != null ? roasEffective >= breakEvenRoas : null;

  const campaignSignals = buildSignals({
    campaigns,
    pacingLabel,
    pacingRatio,
    spendToday,
    hasCodLink: linkedStores.length > 0,
  });
  const signals = [...burnSignals, ...campaignSignals].slice(0, 8);
  const perfSummary = summarizePerf(campaigns, {
    advertisersQueried: perf.advertisersQueried,
    advertisersOk: perf.advertisersOk,
    fetchedAt: perf.fetchedAt,
    error: perf.error,
  });
  // Semáforo: performance anclada a 30d (no al filtro Hoy / rango UI). Solo staff.
  let staffOps: ProfitStaffOps | null = null;
  if (scorePerf) {
    const scoreMerged = mergeCampaignsWithTikTokPerf({
      holisticCampaigns: sliceHolisticSpend(wide, from30, today).byCampaign,
      perfRows: scorePerf.rows,
    });
    const scoreCampaigns = buildCampaignsFromSpend({
      collectedRevenue: 0,
      adSpend: spend30d,
      rows: scoreMerged,
    });
    const scorePerfSummary = summarizePerf(scoreCampaigns, {
      advertisersQueried: scorePerf.advertisersQueried,
      advertisersOk: scorePerf.advertisersOk,
      fetchedAt: scorePerf.fetchedAt,
      error: scorePerf.error,
    });
    staffOps = await loadProfitStaffOps({
      hecomClienteId: input.hecomClienteId,
      spendTodayUsd: spendToday,
      spend90dUsd: spend90d,
      pacingLabel,
      burnSignals,
      score: {
        spend7d,
        spend30d,
        pacingLabel,
        avgCtr: scorePerfSummary.avgCtr,
        clicks: scorePerfSummary.clicks,
        conversions: scorePerfSummary.conversions,
        impressions: scorePerfSummary.impressions,
        hasCodLink: linkedStores.length > 0,
        aboveBreakEven,
        warnKinds: signals
          .filter((signal) => signal.severity !== "info")
          .map((signal) => signal.kind),
      },
    });
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
      totalAdSpend > 0 && collectedUsd > 0
        ? round2(collectedUsd / totalAdSpend)
        : null,
    hasCodLink: linkedStores.length > 0,
    ordersCollected,
    cpaCollected,
    avgOrderCollected,
    feePercent,
    effectiveAdSpend,
    roasEffective,
    breakEvenRoas,
    aboveBreakEven,
    dataThroughDate,
    signals,
    perf: perfSummary,
  };

  return {
    linkedStores,
    snapshots,
    analysis,
    staffOps,
  };
}
