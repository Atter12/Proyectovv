import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { finalizeCreditLockSetup } from "@/lib/payments/credit-lock/credit-lock.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

/**
 * Vuelta de Whop con `setup_intent_id`. Confirma contra la API de Whop; si
 * aún procesa, el webhook `setup_intent.succeeded` guarda la tarjeta.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.organizationId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const actingAsCliente = await getActingAsCliente(session.id);
  const capabilities = withActAsClienteView(
    await resolvePaymentsFundingCapabilities({
      email: session.email,
      role: session.role,
    }),
    actingAsCliente,
  );
  if (!capabilities.canClientStripeFund) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  let body: { setupIntentId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const setupIntentId = body.setupIntentId?.trim();
  if (!setupIntentId) {
    return NextResponse.json({ error: "setupIntentId requerido." }, { status: 400 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  const hecomClienteId = selected?.id ?? null;
  const clienteOrgId = hecomClienteId
    ? await resolveOrganizationIdForHecomCliente(hecomClienteId)
    : null;
  const organizationId =
    (actingAsCliente || Boolean(hecomClienteId)) && clienteOrgId
      ? clienteOrgId
      : session.organizationId;

  try {
    const result = await finalizeCreditLockSetup({ setupIntentId, organizationId });
    return NextResponse.json({ ok: true, saved: result.saved });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar la tarjeta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
