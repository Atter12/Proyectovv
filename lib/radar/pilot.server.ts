import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { shiftYmd, todayYmdInTz } from "@/lib/hecom/gasto-date";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { TikTokApiError, tiktokRequest } from "@/lib/integrations/tiktok/http.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadClientAdvertisers } from "@/lib/radar/advertisers.server";
import { buildPilotProposals, type PilotDayRow, type PilotProposal } from "@/lib/radar/pilot";

/**
 * Piloto (Fase 5). Las propuestas se calculan siempre en el servidor con los
 * últimos 14 días de radar_ad_daily; el navegador solo manda el id de la
 * propuesta que el cliente confirma, y aquí se vuelve a validar todo.
 */

const WINDOW_DAYS = 14;
/** Lo hecho o descartado no se vuelve a proponer durante una semana. */
const QUIET_DAYS = 7;

export type PilotState = {
  proposals: PilotProposal[];
  averageCostPerResult: number | null;
  dataThrough: string | null;
  actionsEnabled: boolean;
};

async function loadRows(hecomClienteId: string): Promise<PilotDayRow[]> {
  const admin = createAdminClient();
  const since = shiftYmd(todayYmdInTz("America/Lima"), -WINDOW_DAYS);
  const rows: PilotDayRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin
      .from("radar_ad_daily")
      .select("advertiser_id, ad_id, adgroup_id, campaign_id, ad_name, stat_date, spend, impressions, clicks, results")
      .eq("hecom_cliente_id", hecomClienteId)
      .gte("stat_date", since)
      .range(offset, offset + 999);
    if (error) throw new Error(`radar_ad_daily: ${error.message}`);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      rows.push({
        advertiserId: String(r.advertiser_id),
        adId: String(r.ad_id),
        adgroupId: (r.adgroup_id as string | null) ?? null,
        campaignId: (r.campaign_id as string | null) ?? null,
        adName: (r.ad_name as string | null) ?? null,
        statDate: String(r.stat_date).slice(0, 10),
        spend: Number(r.spend ?? 0),
        impressions: r.impressions == null ? null : Number(r.impressions),
        clicks: r.clicks == null ? null : Number(r.clicks),
        results: r.results == null ? null : Number(r.results),
      });
    }
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function recentlyHandled(hecomClienteId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - QUIET_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("radar_pilot_actions")
    .select("proposal_id, status")
    .eq("hecom_cliente_id", hecomClienteId)
    .gte("created_at", since);
  if (error) throw new Error(`radar_pilot_actions: ${error.message}`);
  // Una pausa que falló puede volver a intentarse; lo hecho o descartado no.
  return new Set(
    ((data ?? []) as Array<{ proposal_id: string; status: string }>)
      .filter((r) => r.status === "done")
      .map((r) => r.proposal_id),
  );
}

export async function getPilotState(hecomClienteId: string): Promise<PilotState> {
  const [rows, handled] = await Promise.all([loadRows(hecomClienteId), recentlyHandled(hecomClienteId)]);
  const result = buildPilotProposals(rows, { dismissedIds: handled });
  return { ...result, actionsEnabled: serverEnv.pilotActionsEnabled };
}

export type PilotActionResult = { ok: true } | { ok: false; status: number; error: string };

async function record(input: {
  hecomClienteId: string;
  proposal: PilotProposal;
  kind: "pause_ad" | "dismiss";
  status: "done" | "failed";
  error?: string | null;
  requestId?: string | null;
  userId?: string | null;
}) {
  const admin = createAdminClient();
  const target =
    input.proposal.kind === "pause_loser" || input.proposal.kind === "pause_loser_same_group"
      ? input.proposal.loser
      : input.proposal.kind === "scale_winner"
        ? input.proposal.winner
        : input.proposal.kind === "refresh_fatigued"
          ? input.proposal.ad
          : null;
  const userId =
    input.userId && /^[0-9a-f-]{36}$/i.test(input.userId) ? input.userId : null;
  const { error } = await admin.from("radar_pilot_actions").insert({
    hecom_cliente_id: input.hecomClienteId,
    proposal_id: input.proposal.id,
    kind: input.kind,
    advertiser_id: target?.advertiserId ?? null,
    ad_id: target?.adId ?? null,
    status: input.status,
    error: input.error ?? null,
    proposal: input.proposal,
    tiktok_request_id: input.requestId ?? null,
    requested_by: userId,
  });
  if (error) throw new Error(`radar_pilot_actions: ${error.message}`);
}

/**
 * Ejecuta lo que el cliente confirmó. "dismiss" solo registra. "pause" pausa
 * el anuncio perdedor en TikTok (DISABLE, reversible) tras revalidar que la
 * propuesta sigue vigente y que la cuenta es de este cliente.
 */
export async function runPilotAction(input: {
  hecomClienteId: string;
  proposalId: string;
  action: "pause" | "dismiss";
  userId?: string | null;
}): Promise<PilotActionResult> {
  const state = await getPilotState(input.hecomClienteId);
  const proposal = state.proposals.find((p) => p.id === input.proposalId);
  if (!proposal) {
    return { ok: false, status: 409, error: "Esta propuesta ya no está vigente. Actualiza la página." };
  }

  if (input.action === "dismiss") {
    await record({ hecomClienteId: input.hecomClienteId, proposal, kind: "dismiss", status: "done", userId: input.userId });
    return { ok: true };
  }

  if (proposal.kind !== "pause_loser" && proposal.kind !== "pause_loser_same_group") {
    return { ok: false, status: 400, error: "Esta propuesta no se ejecuta desde aquí." };
  }
  if (!serverEnv.pilotActionsEnabled) {
    return {
      ok: false,
      status: 403,
      error: "Pausar desde Profit todavía no está activo. Pídeselo a tu gerente o hazlo en TikTok Ads Manager.",
    };
  }

  const { advertiserId, adId } = proposal.loser;
  const { byAdvertiser } = await loadClientAdvertisers();
  if (byAdvertiser.get(advertiserId) !== input.hecomClienteId) {
    return { ok: false, status: 403, error: "Esta cuenta no pertenece a tu negocio." };
  }

  try {
    const { token } = await resolveTikTokFinanceAccessToken();
    const data = await tiktokRequest<{ request_id?: string }>({
      path: "/ad/status/update/",
      method: "POST",
      accessToken: token,
      body: { advertiser_id: advertiserId, ad_ids: [adId], operation_status: "DISABLE" },
    });
    await record({
      hecomClienteId: input.hecomClienteId,
      proposal,
      kind: "pause_ad",
      status: "done",
      requestId: data?.request_id ?? null,
      userId: input.userId,
    });
    console.info("[radar] pilot_pause_done", { advertiserId, adId });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error de TikTok";
    await record({
      hecomClienteId: input.hecomClienteId,
      proposal,
      kind: "pause_ad",
      status: "failed",
      error: message,
      requestId: error instanceof TikTokApiError ? error.requestId : null,
      userId: input.userId,
    }).catch(() => undefined);
    console.warn("[radar] pilot_pause_failed", { advertiserId, adId, message });
    return {
      ok: false,
      status: 502,
      error: "TikTok no aceptó la pausa. Puedes hacerlo en TikTok Ads Manager; ya quedó registrado para tu gerente.",
    };
  }
}
