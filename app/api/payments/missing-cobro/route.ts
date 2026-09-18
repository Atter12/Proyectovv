import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import { createMissingCobroClaim } from "@/lib/payments/create-missing-cobro-claim.server";
import { listMissingCobroClaimsForCliente } from "@/services/payments.service";
import { listRecentPeriodos } from "@/lib/payments/missing-cobro.shared";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "payments:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id) {
    return NextResponse.json({
      ok: true,
      claims: [],
      periodos: listRecentPeriodos(6),
    });
  }

  const claims = await listMissingCobroClaimsForCliente(selected.id);
  return NextResponse.json({
    ok: true,
    claims,
    periodos: listRecentPeriodos(6),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create") &&
    !hasPermission(session.permissions, "payments:read")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const actingAsCliente = await getActingAsCliente(session.id);
  const capabilities = withActAsClienteView(
    resolvePaymentsFundingCapabilities({
      email: session.email,
      role: session.role,
    }),
    actingAsCliente,
  );

  // Cliente, “viendo como”, o staff con cliente seleccionado pueden reportar.
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id) {
    return NextResponse.json(
      { error: "Selecciona un cliente para reportar el cobro faltante." },
      { status: 400 },
    );
  }

  if (
    !capabilities.isStaff &&
    !capabilities.isSuperAdmin &&
    !actingAsCliente &&
    !capabilities.canClientStripeFund
  ) {
    // clientes con payments:read siguen pudiendo reportar
  }

  let body: {
    amountUsd?: number;
    periodoResumen?: string;
    paymentFecha?: string;
    metodo?: string;
    operationCode?: string;
    notes?: string;
    amountPen?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const organizationId = await resolveOrganizationIdForHecomCliente(selected.id);
  if (!organizationId) {
    return NextResponse.json(
      {
        error:
          "Este cliente aún no tiene organización en Holistic. Pide a soporte que revise el vínculo.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await createMissingCobroClaim({
      session,
      hecomClienteId: selected.id,
      hecomClienteName: selected.name,
      organizationId,
      amountUsd: Number(body.amountUsd),
      periodoResumen: String(body.periodoResumen ?? ""),
      paymentFecha: String(body.paymentFecha ?? ""),
      metodo: body.metodo,
      operationCode: body.operationCode,
      notes: body.notes,
      amountPen:
        typeof body.amountPen === "number" ? body.amountPen : null,
    });

    return NextResponse.json({
      ok: true,
      paymentIntentId: result.paymentIntentId,
      status: result.status,
      amountCents: result.amountCents,
      periodoResumen: result.periodoResumen,
      message:
        "Reporte creado. Ahora sube el comprobante para que gerencia lo revise.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo crear el reporte de cobro faltante.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
