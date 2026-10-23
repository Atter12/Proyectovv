import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import { getHecomAdAccountsLiveMetrics } from "@/lib/hecom/ad-account-live.server";
import type { LaunchAction } from "@/lib/campaigns/launch-optimizer";

const FROZEN_STATES = ["congelado", "cobranza", "castigo"];
/** Días de saldo que tiene que cubrir el presupuesto nuevo antes de subirlo. */
const BALANCE_DAYS = 2;

export type LaunchSummary = {
  id: string;
  advertiserId: string;
  campaignId: string;
  campaignName: string;
  dailyBudget: number;
  optimizeMode: "off" | "suggest" | "auto";
  createdAt: string;
  actions: { id: string; kind: LaunchAction["kind"]; status: string; payload: LaunchAction; createdAt: string; error: string | null }[];
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
    .select("id, launch_id, kind, status, payload, created_at, error")
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
    }
    // new_video y all_losing no tocan TikTok: "aplicar" = el equipo ya lo atendió.
    await close("applied");
    return { ok: true, status: "applied" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok rechazó el cambio.";
    await close("failed", { error: message.slice(0, 500) }).catch(() => undefined);
    return { ok: false, message };
  }
}

/** Pausa un video dentro del anuncio Smart+ (nunca el último activo). */
async function pauseVideo(action: Extract<LaunchAction, { kind: "pause_video" }>) {
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
    if (active.length <= 1) throw new Error("Es el único video activo del anuncio: pausarlo apagaría la campaña.");
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
