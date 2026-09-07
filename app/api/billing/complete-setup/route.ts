import { formatStripeErrorForUser } from "@/lib/payments/stripe-messages";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { finalizeBillingSetup } from "@/lib/payments/auto-recharge/auto-recharge.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

export async function POST(request: Request) {
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

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requerido." }, { status: 400 });
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
    await finalizeBillingSetup({
      sessionId,
      organizationId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar la tarjeta.";
    return NextResponse.json(
      { error: formatStripeErrorForUser(message) },
      { status: 500 },
    );
  }
}
