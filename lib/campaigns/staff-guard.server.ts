import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export type StaffSession = NonNullable<Awaited<ReturnType<typeof getSession>>> & { organizationId: string };

/** Lanzar campañas y decidir sus sugerencias: por ahora solo el equipo. */
export async function requireCampaignStaff(): Promise<{ session: StaffSession } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  if (!hasPermission(session.permissions, "creativeAnalyzer:create") || !session.organizationId) {
    return { error: NextResponse.json({ error: "Permiso denegado." }, { status: 403 }) };
  }
  const funding = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if (!funding.isStaff && !funding.isSuperAdmin) {
    return { error: NextResponse.json({ error: "Solo para el equipo." }, { status: 403 }) };
  }
  return { session: session as StaffSession };
}

export type CampaignUser = { session: StaffSession; isStaff: boolean };

/**
 * Lanzar y optimizar campañas: el equipo y los clientes (cada cliente solo
 * sobre su propia ficha; las rutas validan que la cuenta sea suya).
 */
export async function requireCampaignUser(): Promise<CampaignUser | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  if (!hasPermission(session.permissions, "creativeAnalyzer:create") || !session.organizationId) {
    return { error: NextResponse.json({ error: "Permiso denegado." }, { status: 403 }) };
  }
  const funding = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  return { session: session as StaffSession, isStaff: funding.isStaff || funding.isSuperAdmin };
}
