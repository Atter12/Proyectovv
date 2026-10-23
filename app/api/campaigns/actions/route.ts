import { NextResponse } from "next/server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { requireCampaignStaff } from "@/lib/campaigns/staff-guard.server";
import { decideLaunchAction, listClienteLaunches } from "@/lib/campaigns/launch-actions.server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Campañas lanzadas del cliente que se está viendo, con sus sugerencias. */
export async function GET() {
  const auth = await requireCampaignStaff();
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
  const auth = await requireCampaignStaff();
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
