import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { hasPermission } from "@/lib/auth/permissions";
import { radarApiContext, radarApiError } from "@/lib/radar/api-context.server";
import { getPilotState, runPilotAction } from "@/lib/radar/pilot.server";

export const runtime = "nodejs";

/** Propuestas del Piloto para el cliente seleccionado. */
export async function GET() {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;
  try {
    const session = await requirePermission("adAccounts:read");
    const state = await getPilotState(ctx.clienteId);
    return NextResponse.json({
      ok: true,
      ...state,
      canAct: hasPermission(session.permissions, "adAccounts:create"),
    });
  } catch (error) {
    return radarApiError(error, "No se pudieron cargar las propuestas.");
  }
}

/** El cliente confirma ("pause") o descarta ("dismiss") una propuesta. */
export async function POST(request: Request) {
  const ctx = await radarApiContext();
  if (!ctx.ok) return ctx.response;

  const session = await requirePermission("adAccounts:read");
  if (!hasPermission(session.permissions, "adAccounts:create")) {
    return NextResponse.json({ error: "Tu usuario solo puede ver estas propuestas." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { proposalId?: unknown; action?: unknown };
  const proposalId = typeof body.proposalId === "string" ? body.proposalId.slice(0, 200) : "";
  const action = body.action === "pause" ? "pause" : body.action === "dismiss" ? "dismiss" : null;
  if (!proposalId || !action) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  try {
    const result = await runPilotAction({ hecomClienteId: ctx.clienteId, proposalId, action, userId: session.id });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return radarApiError(error, "No se pudo completar la acción.");
  }
}
