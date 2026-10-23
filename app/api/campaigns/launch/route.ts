import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCampaignUser, type CampaignUser } from "@/lib/campaigns/staff-guard.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { clienteFrozenState } from "@/lib/campaigns/launch-actions.server";
import { resolveTikTokFinanceAccessToken } from "@/lib/integrations/tiktok/bc-finance.server";
import { createAccountIdentity, loadAccountIdentities, loadLaunchOptions } from "@/lib/campaigns/launch-options.server";
import { createSmartPlusCampaign } from "@/lib/campaigns/smart-plus-create.server";
import {
  COUNTRY_LOCATION_IDS,
  type CampaignCountry,
  type SmartPlusIdentity,
} from "@/lib/campaigns/smart-plus-plan";

export const runtime = "nodejs";
// Crear campaña + subir portadas puede tardar.
export const maxDuration = 60;

/** La cuenta tiene que ser de la organización y estar aprobada. */
async function resolveAccount(
  organizationId: string,
  adAccountId: string,
): Promise<{ advertiserId: string; hecomClienteId: string | null } | null> {
  const { data } = await createAdminClient()
    .from("ad_accounts")
    .select("external_account_id, status, metadata")
    .eq("id", adAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ external_account_id: string | null; status: string; metadata: Record<string, unknown> | null }>();
  if (!data?.external_account_id || data.status !== "active") return null;
  const cliente = data.metadata?.hecom_cliente_id;
  return {
    advertiserId: data.external_account_id.trim(),
    hecomClienteId: typeof cliente === "string" && cliente.trim() ? cliente.trim() : null,
  };
}

/**
 * Cuenta elegida, validada: el cliente solo puede usar cuentas de su propia
 * ficha; el equipo, cualquiera aprobada de la organización.
 *
 * Igual que la lista de cuentas de Creativos, una cuenta sin la marca
 * hecom_cliente_id cuenta como del cliente si su advertiser está en su ficha
 * de Hecom. En ese caso se devuelve con el cliente, para que la campaña quede
 * registrada a su nombre y le aparezca en "Campañas lanzadas".
 */
async function resolveAccountFor(
  auth: CampaignUser,
  adAccountId: string,
): Promise<{ advertiserId: string; hecomClienteId: string | null } | null> {
  const account = adAccountId ? await resolveAccount(auth.session.organizationId, adAccountId) : null;
  if (!account) return null;
  const cliente = await getSelectedHecomCliente(auth.session.id);
  if (cliente && account.hecomClienteId === cliente.id) return account;
  if (cliente && !account.hecomClienteId) {
    const data = await getHecomClienteDashboard(cliente.id, {
      includeCampaignSpend: false,
      includeDailySpend: false,
      includeCreativos: false,
    }).catch(() => null);
    const own = (data?.accounts ?? []).some((a) => a.advertiserId?.trim() === account.advertiserId);
    if (own) return { ...account, hecomClienteId: cliente.id };
  }
  return auth.isStaff ? account : null;
}

/** Píxeles, identidades y videos de la cuenta elegida. */
export async function GET(request: Request) {
  const auth = await requireCampaignUser();
  if ("error" in auth) return auth.error;
  const adAccountId = new URL(request.url).searchParams.get("adAccountId")?.trim() ?? "";
  const account = await resolveAccountFor(auth, adAccountId);
  if (!account) return NextResponse.json({ error: "Elige una cuenta aprobada." }, { status: 400 });
  const { advertiserId } = account;
  try {
    const { token } = await resolveTikTokFinanceAccessToken(auth.session.organizationId ?? undefined);
    const options = await loadLaunchOptions({
      accessToken: token,
      advertiserId,
      organizationId: auth.session.organizationId ?? undefined,
    });
    return NextResponse.json({ ok: true, advertiserId, ...options });
  } catch (error) {
    console.warn("[campaigns/launch] options", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No se pudo leer la cuenta en TikTok." }, { status: 502 });
  }
}

/** Crea la campaña Smart+ pausada. */
export async function POST(request: Request) {
  const auth = await requireCampaignUser();
  if ("error" in auth) return auth.error;
  const { session } = auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const strList = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
  const adAccountId = str(body.adAccountId);
  const account = await resolveAccountFor(auth, adAccountId);
  if (!account) return NextResponse.json({ error: "Elige una cuenta aprobada." }, { status: 400 });
  const { advertiserId } = account;
  if (account.hecomClienteId) {
    const frozen = await clienteFrozenState(account.hecomClienteId);
    if (frozen) {
      return NextResponse.json(
        { ok: false, step: "validate", message: `La cuenta está en ${frozen}: no se pueden lanzar campañas.` },
        { status: 403 },
      );
    }
  }

  const country = str(body.country) as CampaignCountry;
  if (!(country in COUNTRY_LOCATION_IDS)) return NextResponse.json({ error: "País inválido." }, { status: 400 });
  const identityRaw = (body.identity ?? {}) as Record<string, unknown>;
  const identityType = str(identityRaw.type);
  if (!["TT_USER", "CUSTOMIZED_USER", "BC_AUTH_TT", "NEW"].includes(identityType)) {
    return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
  }

  try {
    const { token } = await resolveTikTokFinanceAccessToken(session.organizationId ?? undefined);
    // El perfil tiene que ser de esta cuenta: nunca uno de otro cliente del BC.
    let identity: SmartPlusIdentity;
    if (identityType === "NEW") {
      identity = await createAccountIdentity(token, advertiserId, str(identityRaw.name));
    } else {
      const own = await loadAccountIdentities(token, advertiserId);
      const match = own.find((i) => i.type === identityType && i.id === str(identityRaw.id));
      if (!match) return NextResponse.json({ error: "Ese perfil no es de esta cuenta." }, { status: 403 });
      identity = match;
    }
    const plan = {
      advertiserId,
      campaignName: str(body.campaignName),
      dailyBudget: Number(body.dailyBudget),
      country,
      pixelId: str(body.pixelId),
      videoIds: strList(body.videoIds),
      adTexts: strList(body.adTexts),
      landingPageUrl: str(body.landingPageUrl),
      identity,
    };
    const result = await createSmartPlusCampaign({ accessToken: token, plan });
    const admin = createAdminClient();
    if (result.ok) {
      // Registro para la optimización diaria: solo estas campañas se tocan.
      const { error: launchError } = await admin.from("campaign_launches").insert({
        organization_id: session.organizationId,
        hecom_cliente_id: account.hecomClienteId,
        ad_account_id: adAccountId,
        advertiser_id: advertiserId,
        campaign_id: result.campaignId,
        adgroup_id: result.adgroupId,
        ad_id: result.adId,
        campaign_name: plan.campaignName,
        daily_budget: plan.dailyBudget,
        country,
        pixel_id: plan.pixelId,
        video_ids: plan.videoIds,
        created_by: session.id,
      });
      if (launchError) console.warn("[campaigns/launch] registry", { error: launchError.message });
    }
    await admin.from("audit_logs").insert({
      organization_id: session.organizationId,
      actor_user_id: session.id,
      action: result.ok ? "campaign.smart_plus.created" : "campaign.smart_plus.failed",
      entity_type: "ad_account",
      entity_id: adAccountId,
      metadata: { advertiser_id: advertiserId, ...result },
    });
    return NextResponse.json({ ...result, advertiserId }, { status: result.ok ? 200 : 422 });
  } catch (error) {
    console.warn("[campaigns/launch] create", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, step: "campaign", message: "No se pudo conectar con TikTok." }, { status: 502 });
  }
}
