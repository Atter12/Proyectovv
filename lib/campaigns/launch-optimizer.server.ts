import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import { buildPilotProposals, type PilotDayRow } from "@/lib/radar/pilot";
import { buildLaunchActions, type LaunchAction, type LaunchRef } from "@/lib/campaigns/launch-optimizer";

/** Ventana que miran las reglas (igual que el Piloto). */
const WINDOW_DAYS = 14;
/** Lo aplicado o descartado no se vuelve a proponer por estos días. */
const QUIET_DAYS = 7;
/** Una sugerencia que nadie atendió y ya no sale se da por vencida. */
const EXPIRE_DAYS = 3;

type LaunchRow = {
  id: string;
  hecom_cliente_id: string | null;
  advertiser_id: string;
  campaign_id: string;
  daily_budget: number;
  max_daily_budget: number | null;
  optimize_mode: "off" | "suggest" | "auto";
};

export type LaunchOptimizerResult = {
  launches: number;
  suggested: number;
  expired: number;
  skipped: { campaignId: string; reason: string }[];
  /** Con dryRun: lo que se habría sugerido, sin guardar nada. */
  actions?: LaunchAction[];
};

/**
 * Arma las sugerencias del día para las campañas lanzadas desde Ads Holistic
 * (después del radar de la madrugada). Solo guarda sugerencias: aplicarlas es
 * otro paso (aprobación del equipo o modo auto).
 */
export async function runLaunchOptimizer(input: { deadlineMs: number; dryRun?: boolean }): Promise<LaunchOptimizerResult> {
  const admin = createAdminClient();
  const { data: launchRows, error } = await admin
    .from("campaign_launches")
    .select("id, hecom_cliente_id, advertiser_id, campaign_id, daily_budget, max_daily_budget, optimize_mode")
    .neq("optimize_mode", "off");
  if (error) throw new Error(`campaign_launches: ${error.message}`);
  const launches = (launchRows ?? []) as LaunchRow[];
  const result: LaunchOptimizerResult = { launches: launches.length, suggested: 0, expired: 0, skipped: [] };
  if (launches.length === 0) return result;

  const { token } = await resolveTikTokFinanceAccessToken(undefined);
  const to = shiftYmd(todayYmdInTz("America/Lima"), -1);
  const from = shiftYmd(to, -(WINDOW_DAYS - 1));
  const quietSince = new Date(Date.now() - QUIET_DAYS * 86_400_000).toISOString();

  // Acciones recientes: lo aplicado/descartado no vuelve a salir, y lo ya sugerido no se duplica.
  const { data: recent } = await admin
    .from("campaign_optimization_actions")
    .select("launch_id, action_key, status")
    .in("launch_id", launches.map((l) => l.id))
    .or(`status.eq.suggested,created_at.gte.${quietSince}`);
  const blocked = new Set((recent ?? []).map((r) => r.action_key as string));

  // Agrupar por cliente: el promedio de costo es el de todo el cliente.
  const groups = new Map<string, LaunchRow[]>();
  for (const l of launches) {
    const key = l.hecom_cliente_id ? `c:${l.hecom_cliente_id}` : `a:${l.advertiser_id}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  const allActions: LaunchAction[] = [];
  for (const [key, group] of groups) {
    if (Date.now() > input.deadlineMs) {
      for (const l of group) result.skipped.push({ campaignId: l.campaign_id, reason: "sin tiempo" });
      continue;
    }
    const rows = await loadRows(key, from, to);
    const refs: LaunchRef[] = [];
    for (const l of group) {
      const budget = await liveBudget(token, l.advertiser_id, l.campaign_id);
      if (budget === null) {
        result.skipped.push({ campaignId: l.campaign_id, reason: "no se pudo leer en TikTok" });
        continue;
      }
      refs.push({
        id: l.id,
        advertiserId: l.advertiser_id,
        campaignId: l.campaign_id,
        dailyBudget: budget,
        maxDailyBudget: l.max_daily_budget === null ? null : Number(l.max_daily_budget),
        initialDailyBudget: Number(l.daily_budget),
      });
    }
    allActions.push(...buildLaunchActions(rows, refs, { buildPilotProposals, dismissedIds: blocked }));
  }

  if (input.dryRun) return { ...result, actions: allActions, suggested: allActions.length };

  if (allActions.length > 0) {
    const { error: insertError } = await admin.from("campaign_optimization_actions").upsert(
      allActions.map((a) => ({
        launch_id: a.launchId,
        action_key: a.id,
        kind: a.kind,
        payload: a,
        status: "suggested",
        data_through: to,
      })),
      { onConflict: "launch_id,action_key", ignoreDuplicates: true },
    );
    if (insertError) throw new Error(`campaign_optimization_actions: ${insertError.message}`);
  }
  result.suggested = allActions.length;

  // Lo sugerido hace días que ya no sale, se vence (la situación cambió).
  const stillValid = new Set(allActions.map((a) => a.id));
  const expireBefore = new Date(Date.now() - EXPIRE_DAYS * 86_400_000).toISOString();
  const { data: stale } = await admin
    .from("campaign_optimization_actions")
    .select("id, action_key")
    .eq("status", "suggested")
    .lt("created_at", expireBefore);
  const toExpire = (stale ?? []).filter((s) => !stillValid.has(s.action_key as string)).map((s) => s.id as string);
  if (toExpire.length > 0) {
    await admin.from("campaign_optimization_actions").update({ status: "expired" }).in("id", toExpire);
    result.expired = toExpire.length;
  }
  return result;
}

/** Filas del radar del cliente (o del anunciante si la campaña no tiene cliente). */
async function loadRows(groupKey: string, from: string, to: string): Promise<PilotDayRow[]> {
  const admin = createAdminClient();
  const [kind, id] = [groupKey.slice(0, 1), groupKey.slice(2)];
  const rows: PilotDayRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = admin
      .from("radar_ad_daily")
      .select("advertiser_id, ad_id, adgroup_id, campaign_id, ad_name, stat_date, spend, impressions, clicks, results")
      .gte("stat_date", from)
      .lte("stat_date", to)
      .order("stat_date", { ascending: true })
      .range(offset, offset + 999);
    query = kind === "c" ? query.eq("hecom_cliente_id", id) : query.eq("advertiser_id", id);
    const { data, error } = await query;
    if (error) throw new Error(`radar_ad_daily: ${error.message}`);
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const n = (v: unknown) => (v == null ? null : Number(v));
      rows.push({
        advertiserId: String(r.advertiser_id),
        adId: String(r.ad_id),
        adgroupId: (r.adgroup_id as string | null) ?? null,
        campaignId: (r.campaign_id as string | null) ?? null,
        adName: (r.ad_name as string | null) ?? null,
        statDate: String(r.stat_date).slice(0, 10),
        spend: Number(r.spend ?? 0),
        impressions: n(r.impressions),
        clicks: n(r.clicks),
        results: n(r.results),
      });
    }
    if (!data || data.length < 1000) break;
  }
  return rows;
}

/** Presupuesto diario actual de la campaña en TikTok (puede haberlo cambiado alguien). */
async function liveBudget(token: string, advertiserId: string, campaignId: string): Promise<number | null> {
  try {
    const res = await tiktokRequest<{ list?: Record<string, unknown>[] }>({
      path: "/smart_plus/campaign/get/",
      accessToken: token,
      query: { advertiser_id: advertiserId, filtering: { campaign_ids: [campaignId] }, page_size: "1" },
    });
    const row = res.list?.[0];
    if (!row) return null;
    return Number(row.budget ?? 0);
  } catch {
    return null;
  }
}
