import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import { getHecomAdAccountsLiveMetrics } from "@/lib/hecom/ad-account-live.server";
import type { LaunchAction } from "@/lib/campaigns/launch-optimizer";
import { addVideosToLaunch } from "@/lib/campaigns/launch-videos.server";

const FROZEN_STATES = ["congelado", "cobranza", "castigo"];
/** Días de saldo que tiene que cubrir el presupuesto nuevo antes de subirlo. */
const BALANCE_DAYS = 2;
/**
 * Modo automático: solo pausa videos, uno por campaña por noche, y siempre
 * deja al menos 2 activos (a mano se puede bajar hasta 1).
 */
const AUTO_KINDS = new Set<LaunchAction["kind"]>(["pause_video"]);
const AUTO_MIN_ACTIVE_LEFT = 2;

export type LaunchSummary = {
  id: string;
  advertiserId: string;
  campaignId: string;
  campaignName: string;
  dailyBudget: number;
  optimizeMode: "off" | "suggest" | "auto";
  createdAt: string;
  actions: {
    id: string;
    kind: LaunchAction["kind"];
    status: string;
    payload: LaunchAction;
    createdAt: string;
    error: string | null;
    /** Lo aplicó el modo automático (sin persona). */
    auto: boolean;
  }[];
};

/** Campañas lanzadas del cliente con sus sugerencias pendientes y lo último decidido. */
export async function listClienteLaunches(hecomClienteId: string): Promise<LaunchSummary[]> {
  const admin = createAdminClient();
  const { data: launches, error } = await admin
    .from("campaign_launches")
    .select("id, advertiser_id, campaign_id, campaign_name, daily_budget, optimize_mode, created_at")
    .eq("hecom_cliente_id", hecomClienteId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`campaign_launches: ${error.message}`);
  if (!launches?.length) return [];
  const { data: actions } = await admin
    .from("campaign_optimization_actions")
    .select("id, launch_id, kind, status, payload, created_at, error, decided_by")
    .in("launch_id", launches.map((l) => l.id))
    .in("status", ["suggested", "applied", "failed"])
    .order("created_at", { ascending: false })
    .limit(200);
  return launches.map((l) => ({
    id: l.id,
    advertiserId: l.advertiser_id,
    campaignId: l.campaign_id,
    campaignName: l.campaign_name,
    dailyBudget: Number(l.daily_budget),
    optimizeMode: l.optimize_mode,
    createdAt: l.created_at,
    actions: (actions ?? [])
      .filter((a) => a.launch_id === l.id)
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        payload: a.payload as LaunchAction,
        createdAt: a.created_at,
        error: a.error,
        auto: a.status === "applied" && !a.decided_by,
      })),
  }));
}

export type DecideResult = { ok: true; status: "applied" | "dismissed" } | { ok: false; message: string };

/**
 * Aprobar (aplicar en TikTok) o descartar una sugerencia. Solo sugerencias
 * pendientes de campañas del cliente indicado.
 */
export async function decideLaunchAction(input: {
  actionId: string;
  hecomClienteId: string;
  decision: "apply" | "dismiss";
  userId: string;
  /** "Cambiar video" / "Todo pierde": videos nuevos que se suman a la campaña al aprobar. */
  videoIds?: string[];
}): Promise<DecideResult> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("campaign_optimization_actions")
    .select("id, status, kind, payload, launch_id, campaign_launches!inner(hecom_cliente_id, advertiser_id, campaign_id, daily_budget)")
    .eq("id", input.actionId)
    .maybeSingle();
  const launch = (row as { campaign_launches?: Record<string, unknown> } | null)?.campaign_launches;
  if (!row || !launch || launch.hecom_cliente_id !== input.hecomClienteId) {
    return { ok: false, message: "Sugerencia no encontrada." };
  }
  if (row.status !== "suggested") return { ok: false, message: "Esta sugerencia ya se decidió." };

  const close = async (status: "applied" | "dismissed" | "failed", extra: Record<string, unknown> = {}) => {
    const { error: updateError } = await admin
      .from("campaign_optimization_actions")
      .update({ status, decided_by: input.userId, decided_at: new Date().toISOString(), ...extra })
      .eq("id", row.id)
      .eq("status", "suggested");
    if (updateError) throw new Error(`No se pudo guardar la decisión: ${updateError.message}`);
  };

  if (input.decision === "dismiss") {
    try {
      await close("dismissed");
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "No se pudo descartar." };
    }
    return { ok: true, status: "dismissed" };
  }

  const action = row.payload as LaunchAction;
  try {
    if (action.kind === "pause_video") {
      await pauseVideo(action);
    } else if (action.kind === "raise_budget") {
      const check = await canRaiseBudget(input.hecomClienteId, action.advertiserId, action.toBudget);
      if (!check.ok) return { ok: false, message: check.message };
      await raiseBudget(action);
      await admin.from("campaign_launches").update({ daily_budget: action.toBudget }).eq("id", row.launch_id);
    } else if (input.videoIds?.length) {
      // Cambiar video / todo pierde: se suman los videos elegidos. Sin videos,
      // "aplicar" solo marca que el equipo ya lo atendió por fuera.
      const added = await addVideosToLaunch({
        launchId: row.launch_id,
        hecomClienteId: input.hecomClienteId,
        videoIds: input.videoIds,
      });
      if (!added.ok) return { ok: false, message: added.message };
    }
    await close("applied");
    return { ok: true, status: "applied" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok rechazó el cambio.";
    await close("failed", { error: message.slice(0, 500) }).catch(() => undefined);
    return { ok: false, message };
  }
}

/** Cambia el modo de optimización de una campaña lanzada del cliente. */
export async function setLaunchMode(input: {
  launchId: string;
  hecomClienteId: string;
  mode: "suggest" | "auto";
}): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("campaign_launches")
    .update({ optimize_mode: input.mode })
    .eq("id", input.launchId)
    .eq("hecom_cliente_id", input.hecomClienteId)
    .select("id");
  if (error) throw new Error(`campaign_launches: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Modo automático: aplica las pausas sugeridas de las campañas en "auto".
 * Corre al final del optimizador nocturno. Lo que no se puede aplicar queda
 * como sugerencia para que el equipo lo vea.
 */
export async function applyAutoActions(input: { deadlineMs: number }): Promise<{ applied: number; failed: number }> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("campaign_optimization_actions")
    .select("id, launch_id, kind, payload, created_at, campaign_launches!inner(optimize_mode)")
    .eq("status", "suggested")
    .eq("campaign_launches.optimize_mode", "auto")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`campaign_optimization_actions: ${error.message}`);
  const out = { applied: 0, failed: 0 };
  const touched = new Set<string>();
  for (const row of rows ?? []) {
    if (Date.now() > input.deadlineMs) break;
    if (!AUTO_KINDS.has(row.kind as LaunchAction["kind"]) || touched.has(row.launch_id)) continue;
    touched.add(row.launch_id);
    const action = row.payload as Extract<LaunchAction, { kind: "pause_video" }>;
    try {
      await pauseVideo(action, AUTO_MIN_ACTIVE_LEFT);
      await admin
        .from("campaign_optimization_actions")
        .update({ status: "applied", decided_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "suggested");
      out.applied += 1;
    } catch (err) {
      // Queda sugerida con el motivo: el equipo decide a mano.
      await admin
        .from("campaign_optimization_actions")
        .update({ error: `Automático no aplicó: ${err instanceof Error ? err.message : "error"}`.slice(0, 500) })
        .eq("id", row.id);
      out.failed += 1;
    }
  }
  return out;
}

/** Pausa un video dentro del anuncio Smart+ (nunca el último activo). */
async function pauseVideo(action: Extract<LaunchAction, { kind: "pause_video" }>, minActiveLeft = 1) {
  const { token } = await resolveTikTokFinanceAccessToken(undefined);
  const ads = await tiktokRequest<{ list?: Record<string, unknown>[] }>({
    path: "/smart_plus/ad/get/",
    accessToken: token,
    query: { advertiser_id: action.advertiserId, filtering: { campaign_ids: [action.campaignId] }, page_size: "20" },
  });
  for (const ad of ads.list ?? []) {
    const materials = (ad.creative_list as Record<string, unknown>[] | undefined) ?? [];
    const target = materials.find((m) => String(m.smart_plus_creative_id ?? "") === action.creativeId);
    if (!target) continue;
    const active = materials.filter((m) => m.material_operation_status !== "DISABLE");
    if (target.material_operation_status === "DISABLE") throw new Error("Ese video ya está pausado.");
    if (active.length - 1 < minActiveLeft) {
      throw new Error(
        active.length <= 1
          ? "Es el único video activo del anuncio: pausarlo apagaría la campaña."
          : `Quedarían menos de ${minActiveLeft} videos activos.`,
      );
    }
    await tiktokRequest({
      path: "/smart_plus/ad/material_status/update/",
      method: "POST",
      accessToken: token,
      body: {
        advertiser_id: action.advertiserId,
        smart_plus_ad_id: String(ad.smart_plus_ad_id),
        ad_material_ids: [String(target.ad_material_id)],
        operation_status: "DISABLE",
      },
    });
    return;
  }
  throw new Error("No se encontró ese video en la campaña (¿ya lo pausaron?).");
}

/** Sube el presupuesto diario de la campaña. */
async function raiseBudget(action: Extract<LaunchAction, { kind: "raise_budget" }>) {
  const { token } = await resolveTikTokFinanceAccessToken(undefined);
  await tiktokRequest({
    path: "/smart_plus/campaign/update/",
    method: "POST",
    accessToken: token,
    body: { advertiser_id: action.advertiserId, campaign_id: action.campaignId, budget: action.toBudget },
  });
}

/** Cliente sin congelar y con saldo para BALANCE_DAYS días del presupuesto nuevo. */
async function canRaiseBudget(
  hecomClienteId: string,
  advertiserId: string,
  newBudget: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: estado } = await createAdminClient()
    .from("cliente_cobranza_estado")
    .select("estado")
    .eq("hecom_cliente_id", hecomClienteId)
    .maybeSingle<{ estado: string }>();
  if (estado && FROZEN_STATES.includes(estado.estado)) {
    return { ok: false, message: `El cliente está en ${estado.estado}: no se sube presupuesto.` };
  }
  const live = await getHecomAdAccountsLiveMetrics(hecomClienteId, "fast", { bypassCache: true }).catch(() => null);
  const account = live?.accounts.find((a) => a.advertiserId === advertiserId);
  const balance = account?.balanceUsd ?? null;
  if (balance === null) return { ok: false, message: "No se pudo confirmar el saldo de la cuenta en TikTok." };
  const needed = newBudget * BALANCE_DAYS;
  if (balance < needed) {
    return {
      ok: false,
      message: `Saldo insuficiente: tiene USD ${balance.toFixed(2)} y el nuevo presupuesto pide USD ${needed.toFixed(2)} para ${BALANCE_DAYS} días.`,
    };
  }
  return { ok: true };
}
