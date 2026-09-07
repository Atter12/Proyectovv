import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { startBillingSetupSession } from "@/lib/payments/auto-recharge/auto-recharge.server";
import { formatStripeErrorForUser } from "@/lib/payments/stripe-messages";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

export async function POST() {
  const session = await getSession();
  if (!session?.organizationId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const actingAsCliente = await getActingAsCliente(session.id);
  const capabilities = withActAsClienteView(
    resolvePaymentsFundingCapabilities({
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
    const result = await startBillingSetupSession({
      organizationId,
      userId: session.id,
      email: session.email,
    });
    return NextResponse.json({ ok: true, checkoutUrl: result.checkoutUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo iniciar guardado de tarjeta.";
    return NextResponse.json(
      { error: formatStripeErrorForUser(message) },
      { status: 500 },
    );
  }
}
