import { formatStripeErrorForUser } from "@/lib/payments/stripe-messages";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import {
  getAutoRechargeState,
  saveAutoRechargeSchedule,
} from "@/lib/payments/auto-recharge/auto-recharge.server";
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
  const clienteOrgId = await resolveOrganizationIdForHecomCliente(hecomClienteId);
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
    const { organizationId } = await resolveClientWalletOrg(session);
    if (!organizationId) {
      return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
    }
    const state = await getAutoRechargeState(organizationId);
    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo cargar la configuración.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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

  let body: {
    enabled?: boolean;
    intervalDays?: number;
    creditAmount?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    const { organizationId, hecomClienteId } = await resolveClientWalletOrg(session);
    if (!organizationId) {
      return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
    }
    const rule = await saveAutoRechargeSchedule({
      organizationId,
      userId: session.id,
      hecomClienteId,
      enabled: Boolean(body.enabled),
      intervalDays: Number(body.intervalDays ?? 20),
      creditAmountUsd: Number(body.creditAmount ?? 0),
    });

    return NextResponse.json({
      ok: true,
      rule: {
        enabled: rule.enabled,
        intervalDays: rule.calendar_interval_days,
        creditCents: rule.calendar_credit_cents,
        nextChargeAt: rule.calendar_next_charge_at,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo guardar.";
    return NextResponse.json(
      { error: formatStripeErrorForUser(message) },
      { status: 400 },
    );
  }
}
