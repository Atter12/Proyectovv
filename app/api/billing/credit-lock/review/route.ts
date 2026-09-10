import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { reviewCreditLockRequest } from "@/lib/payments/credit-lock/credit-lock.server";
import {
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

/**
 * Gerencia acepta / rechaza el pedido de crédito Holistic del cliente seleccionado.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Usar caps reales (sin act-as-cliente): gerencia aprueba aunque esté viendo como cliente.
  const caps = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!caps.isStaff && !caps.isSuperAdmin) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  let body: { decision?: string; notes?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const decision =
    body.decision === "approved" || body.decision === "rejected"
      ? body.decision
      : null;
  if (!decision) {
    return NextResponse.json(
      { error: "Decisión inválida (approved | rejected)." },
      { status: 400 },
    );
  }

  const selected = await getSelectedHecomCliente(session.id);
  const hecomClienteId = selected?.id ?? null;
  if (!hecomClienteId) {
    return NextResponse.json(
      { error: "Selecciona un cliente Hecom." },
      { status: 400 },
    );
  }

  const clienteOrgId =
    await resolveOrganizationIdForHecomCliente(hecomClienteId);
  if (!clienteOrgId) {
    return NextResponse.json(
      { error: "Organización del cliente no disponible." },
      { status: 400 },
    );
  }
  const organizationId = clienteOrgId;

  try {
    const cupo = await reviewCreditLockRequest({
      organizationId,
      hecomClienteId,
      decision,
      reviewedBy: session.id,
      notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    });
    return NextResponse.json({ ok: true, cupo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo revisar el crédito.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
