import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
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

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Solo el equipo lanza campañas por ahora. */
async function requireStaff(): Promise<{ session: Session } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  if (!hasPermission(session.permissions, "creativeAnalyzer:create") || !session.organizationId) {
    return { error: NextResponse.json({ error: "Permiso denegado." }, { status: 403 }) };
  }
  const funding = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return { error: NextResponse.json({ error: "Solo para el equipo." }, { status: 403 }) };
  }
  return { session };
}

/** La cuenta tiene que ser de la organización y estar aprobada. */
async function resolveAdvertiser(organizationId: string, adAccountId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("ad_accounts")
    .select("external_account_id, status")
    .eq("id", adAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle<{ external_account_id: string | null; status: string }>();
  if (!data?.external_account_id || data.status !== "active") return null;
  return data.external_account_id.trim();
}

/** Píxeles, identidades y videos de la cuenta elegida. */
export async function GET(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  const adAccountId = new URL(request.url).searchParams.get("adAccountId")?.trim() ?? "";
  const advertiserId = adAccountId ? await resolveAdvertiser(auth.session.organizationId!, adAccountId) : null;
  if (!advertiserId) return NextResponse.json({ error: "Elige una cuenta aprobada." }, { status: 400 });
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
  const auth = await requireStaff();
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
  const advertiserId = adAccountId ? await resolveAdvertiser(session.organizationId!, adAccountId) : null;
  if (!advertiserId) return NextResponse.json({ error: "Elige una cuenta aprobada." }, { status: 400 });

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
    const result = await createSmartPlusCampaign({
      accessToken: token,
      plan: {
        advertiserId,
        campaignName: str(body.campaignName),
        dailyBudget: Number(body.dailyBudget),
        country,
        pixelId: str(body.pixelId),
        videoIds: strList(body.videoIds),
        adTexts: strList(body.adTexts),
        landingPageUrl: str(body.landingPageUrl),
        identity,
      },
    });
    await createAdminClient().from("audit_logs").insert({
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
