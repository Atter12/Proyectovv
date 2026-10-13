import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { startCreditLockSetupSession } from "@/lib/payments/credit-lock/credit-lock.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

/** Abre Whop para guardar la tarjeta del crédito Holistic. */
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
  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  let body: { consentAccepted?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
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
    const result = await startCreditLockSetupSession({
      organizationId,
      hecomClienteId,
      userId: session.id,
      consentAccepted: body.consentAccepted === true,
    });
    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo abrir el registro de tarjeta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
