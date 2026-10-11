import "server-only";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/env.server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

/**
 * ¿Puede esta persona ver el Radar? Requiere PROFIT_RADAR_ENABLED y, mientras
 * PROFIT_RADAR_STAFF_ONLY esté encendido, ser staff (aunque esté "viendo como"
 * cliente).
 */
export async function canSeeRadar(session: { email: string; role?: string | null }): Promise<{
  allowed: boolean;
  isStaff: boolean;
}> {
  const funding = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  const isStaff = funding.isStaff || funding.isSuperAdmin;
  const allowed = serverEnv.profitRadarEnabled && (!serverEnv.profitRadarStaffOnly || isStaff);
  return { allowed, isStaff };
}

export type RadarApiContext =
  | { ok: true; clienteId: string; clienteName: string; isStaff: boolean }
  | { ok: false; response: NextResponse };

/** Preámbulo de las rutas /api/profit/radar/*: mismo patrón que /api/profit. */
export async function radarApiContext(): Promise<RadarApiContext> {
  const session = await requirePermission("adAccounts:read");
  const { allowed, isStaff } = await canSeeRadar(session);
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "El Radar no está disponible." }, { status: 404 }) };
  }
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return { ok: false, response: NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 }) };
  }
  return { ok: true, clienteId: selected.id, clienteName: selected.name, isStaff };
}

export function radarApiError(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}
