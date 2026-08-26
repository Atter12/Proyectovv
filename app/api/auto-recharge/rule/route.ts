import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  getAutoRechargeState,
  saveAutoRechargeSchedule,
} from "@/lib/payments/auto-recharge/auto-recharge.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";

export async function GET() {
  const session = await getSession();
  if (!session?.organizationId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.canClientStripeFund) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  try {
    const state = await getAutoRechargeState(session.organizationId);
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

  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
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

  const selected = await getSelectedHecomCliente(session.id);

  try {
    const rule = await saveAutoRechargeSchedule({
      organizationId: session.organizationId,
      userId: session.id,
      hecomClienteId: selected?.id ?? null,
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
