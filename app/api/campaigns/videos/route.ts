import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requireCampaignStaff } from "@/lib/campaigns/staff-guard.server";
import { addVideosToLaunch, listVideosForLaunch } from "@/lib/campaigns/launch-videos.server";

export const runtime = "nodejs";
// Subir portadas + actualizar el anuncio puede tardar.
export const maxDuration = 60;

/** Videos de la cuenta que se pueden sumar a una campaña lanzada. */
export async function GET(request: Request) {
  const auth = await requireCampaignStaff();
  if ("error" in auth) return auth.error;
  const cliente = await getSelectedHecomCliente(auth.session.id);
  const launchId = new URL(request.url).searchParams.get("launchId")?.trim() ?? "";
  if (!cliente || !launchId) return NextResponse.json({ error: "Elige una campaña." }, { status: 400 });
  try {
    const result = await listVideosForLaunch(launchId, cliente.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 404 });
  } catch (error) {
    console.warn("[campaigns/videos] list", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No se pudo leer la cuenta en TikTok." }, { status: 502 });
  }
}

/** Suma videos al anuncio de una campaña lanzada. */
export async function POST(request: Request) {
  const auth = await requireCampaignStaff();
  if ("error" in auth) return auth.error;
  const cliente = await getSelectedHecomCliente(auth.session.id);
  if (!cliente) return NextResponse.json({ error: "Elige un cliente." }, { status: 400 });
  let body: { launchId?: unknown; videoIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const launchId = typeof body.launchId === "string" ? body.launchId : "";
  const videoIds = Array.isArray(body.videoIds) ? body.videoIds.filter((v): v is string => typeof v === "string") : [];
  if (!launchId) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  try {
    const result = await addVideosToLaunch({ launchId, hecomClienteId: cliente.id, videoIds });
    await createAdminClient().from("audit_logs").insert({
      organization_id: auth.session.organizationId,
      actor_user_id: auth.session.id,
      action: result.ok ? "campaign.smart_plus.videos_added" : "campaign.smart_plus.videos_failed",
      entity_type: "campaign_launch",
      entity_id: launchId,
      metadata: { video_ids: videoIds, ...result },
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok rechazó el cambio.";
    console.warn("[campaigns/videos] add", { error: message });
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
