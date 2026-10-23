import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requireCampaignUser } from "@/lib/campaigns/staff-guard.server";
import { BriefError, generateCampaignBrief } from "@/lib/campaigns/campaign-brief.server";
import { COUNTRY_LOCATION_IDS } from "@/lib/campaigns/smart-plus-plan";

export const runtime = "nodejs";
// Leer la página + la IA pueden tardar.
export const maxDuration = 60;

/** Propuestas por persona cada 24 h (cada una es una llamada a OpenAI). */
const DAILY_LIMIT = 40;

const STATUS: Record<BriefError["code"], number> = { badUrl: 400, unreachable: 422, notProduct: 422, ai: 502, noKey: 503 };

/** Link del producto → textos, guion de video y presupuesto sugerido. */
export async function POST(request: Request) {
  const auth = await requireCampaignUser();
  if ("error" in auth) return auth.error;
  const { session } = auth;
  let body: { url?: unknown; country?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim().slice(0, 2000) : "";
  const country = typeof body.country === "string" && body.country in COUNTRY_LOCATION_IDS ? body.country : "PE";
  if (!url) return NextResponse.json({ error: "Pega el link de tu producto." }, { status: 400 });

  const admin = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_user_id", session.id)
    .eq("action", "campaign.brief.generated")
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Llegaste al límite de ${DAILY_LIMIT} propuestas por día. Vuelve mañana.` }, { status: 429 });
  }

  const cliente = await getSelectedHecomCliente(session.id);
  try {
    const result = await generateCampaignBrief({
      url,
      country,
      storeName: cliente?.name ?? null,
      hecomClienteId: cliente?.id ?? null,
    });
    // También sirve de contador para el límite diario.
    const { error: logError } = await admin.from("audit_logs").insert({
      organization_id: session.organizationId,
      actor_user_id: session.id,
      action: "campaign.brief.generated",
      entity_type: "hecom_cliente",
      metadata: { hecom_cliente_id: cliente?.id ?? null, url: result.product.url, title: result.product.title },
    });
    if (logError) console.warn("[campaigns/brief] audit", { error: logError.message });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof BriefError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS[error.code] });
    }
    console.warn("[campaigns/brief]", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No se pudo armar la propuesta. Prueba de nuevo." }, { status: 500 });
  }
}
