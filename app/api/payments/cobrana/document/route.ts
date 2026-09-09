import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  resolvePaymentsFundingCapabilities,
  withActAsClienteView,
} from "@/lib/payments/funding-roles.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { normalizeYapeDocument } from "@/lib/payments/cobrana/document.server";

/**
 * Indica si el cliente seleccionado necesita ingresar DNI/RUC para Yape/Cobrana.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
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
  if (!capabilities.canClientStripeFund) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id) {
    return NextResponse.json({
      ok: true,
      needsDocument: true,
      crmDocument: null,
      message: "Selecciona un cliente para pagar con Yape.",
    });
  }

  const hecomCliente = await getHecomCliente(selected.id);
  const doc = normalizeYapeDocument(hecomCliente?.dni);

  return NextResponse.json({
    ok: true,
    needsDocument: !doc.ok,
    crmDocument: hecomCliente?.dni ?? null,
    documentType: doc.ok ? doc.value.documentType : null,
    message: doc.ok ? null : doc.message,
  });
}
