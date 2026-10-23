import { NextResponse } from "next/server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requireCampaignUser } from "@/lib/campaigns/staff-guard.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decideLaunchAction, listClienteLaunches, setLaunchMode, setLaunchRunning } from "@/lib/campaigns/launch-actions.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Campañas lanzadas del cliente que se está viendo, con sus sugerencias. */
export async function GET() {
  const auth = await requireCampaignUser();
  if ("error" in auth) return auth.error;
  const cliente = await getSelectedHecomCliente(auth.session.id);
  if (!cliente) return NextResponse.json({ ok: true, launches: [] });
  try {
    return NextResponse.json({ ok: true, launches: await listClienteLaunches(cliente.id) });
  } catch (error) {
    console.warn("[campaigns/actions] list", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "No se pudieron leer las campañas." }, { status: 500 });
  }
}

/** Aplicar o descartar una sugerencia. */
export async function POST(request: Request) {
  const auth = await requireCampaignUser();
  if ("error" in auth) return auth.error;
  const cliente = await getSelectedHecomCliente(auth.session.id);
  if (!cliente) return NextResponse.json({ error: "Elige un cliente." }, { status: 400 });
  let body: { actionId?: unknown; decision?: unknown; videoIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const actionId = typeof body.actionId === "string" ? body.actionId : "";
  const decision = body.decision === "apply" ? "apply" : body.decision === "dismiss" ? "dismiss" : null;
  if (!actionId || !decision) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const videoIds = Array.isArray(body.videoIds) ? body.videoIds.filter((v): v is string => typeof v === "string") : undefined;
  const result = await decideLaunchAction({ actionId, hecomClienteId: cliente.id, decision, userId: auth.session.id, videoIds });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

/** Prender/pausar la campaña ({ running }) o pasarla a modo automático (pausa sola los videos que pierden) o volver a solo sugerir. */
export async function PATCH(request: Request) {
  const auth = await requireCampaignUser();
  if ("error" in auth) return auth.error;
  const cliente = await getSelectedHecomCliente(auth.session.id);
  if (!cliente) return NextResponse.json({ error: "Elige un cliente." }, { status: 400 });
  let body: { launchId?: unknown; mode?: unknown; running?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const launchId = typeof body.launchId === "string" ? body.launchId : "";
  if (launchId && typeof body.running === "boolean") {
    try {
      const result = await setLaunchRunning({ launchId, hecomClienteId: cliente.id, running: body.running });
      await createAdminClient().from("audit_logs").insert({
        organization_id: auth.session.organizationId,
        actor_user_id: auth.session.id,
        action: body.running ? "campaign.smart_plus.enabled" : "campaign.smart_plus.paused",
        entity_type: "campaign_launch",
        entity_id: launchId,
        metadata: result,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "TikTok rechazó el cambio.";
      return NextResponse.json({ ok: false, message }, { status: 502 });
    }
  }
  const mode = body.mode === "auto" ? "auto" : body.mode === "suggest" ? "suggest" : null;
  if (!launchId || !mode) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const ok = await setLaunchMode({ launchId, hecomClienteId: cliente.id, mode });
  if (!ok) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });
  await createAdminClient().from("audit_logs").insert({
    organization_id: auth.session.organizationId,
    actor_user_id: auth.session.id,
    action: "campaign.optimize_mode.changed",
    entity_type: "campaign_launch",
    entity_id: launchId,
    metadata: { mode },
  });
  return NextResponse.json({ ok: true, mode });
}
