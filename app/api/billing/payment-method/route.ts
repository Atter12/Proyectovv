import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import {
  detachCreditLockPaymentMethod,
  getCreditLockState,
} from "@/lib/payments/credit-lock/credit-lock.server";
import { formatStripeErrorForUser } from "@/lib/payments/stripe-messages";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

async function resolveClientWalletOrg(session: {
  id: string;
  organizationId: string | null;
}): Promise<{ organizationId: string | null; hecomClienteId: string | null }> {
  const selected = await getSelectedHecomCliente(session.id);
  const actingAsCliente = await getActingAsCliente(session.id);
  const hecomClienteId = selected?.id ?? null;
  if (!hecomClienteId) {
    return { organizationId: session.organizationId, hecomClienteId: null };
  }
  const clienteOrgId =
    await resolveOrganizationIdForHecomCliente(hecomClienteId);
  if ((actingAsCliente || hecomClienteId) && clienteOrgId) {
    return { organizationId: clienteOrgId, hecomClienteId };
  }
  return { organizationId: session.organizationId, hecomClienteId };
}

export async function GET() {
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

  try {
    const { organizationId, hecomClienteId } =
      await resolveClientWalletOrg(session);
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organización no disponible." },
        { status: 400 },
      );
    }
    const state = await getCreditLockState({
      organizationId,
      hecomClienteId,
    });
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar el candado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
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

  try {
    const { organizationId, hecomClienteId } =
      await resolveClientWalletOrg(session);
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organización no disponible." },
        { status: 400 },
      );
    }
    if (!hecomClienteId) {
      return NextResponse.json(
        { error: "Seleccioná un cliente Hecom para quitar la tarjeta." },
        { status: 400 },
      );
    }

    const result = await detachCreditLockPaymentMethod({
      organizationId,
      hecomClienteId,
      userId: session.id,
    });

    return NextResponse.json({
      ok: true,
      detached: result.detached,
      chargedCents: result.chargedCents,
      paymentIntentId: result.paymentIntentId ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo quitar la tarjeta.";
    return NextResponse.json(
      { error: formatStripeErrorForUser(message) },
      { status: 400 },
    );
  }
}
