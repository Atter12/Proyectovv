import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { listAppealsForStaff, updateAppealStatus } from "@/lib/appeals/account-appeals.server";
import type { AppealStatus } from "@/lib/appeals/account-appeals.shared";

export const runtime = "nodejs";

const STATUSES: AppealStatus[] = ["pending", "sent", "approved", "rejected"];

async function requireStaff() {
  const session = await requirePermission("payments:read");
  const caps = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if (!caps.isStaff && !caps.isSuperAdmin) return null;
  return session;
}

/** Bandeja de apelaciones para gerencia. */
export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Solo gerencia." }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, appeals: await listAppealsForStaff() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Cambia el estado (enviada a TikTok / aprobada / rechazada) y notas internas. */
export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Solo gerencia." }, { status: 403 });
  let body: { id?: string; status?: string; staffNotes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const status = body.status as AppealStatus;
  if (!body.id || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  try {
    const appeal = await updateAppealStatus({
      id: body.id,
      status,
      staffNotes: typeof body.staffNotes === "string" ? body.staffNotes : undefined,
      userId: session.id,
    });
    return NextResponse.json({ ok: true, appeal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
