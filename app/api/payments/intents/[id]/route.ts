import { NextResponse } from "next/server";
import { getPaymentIntentById } from "@/lib/payments/payment-intents.server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type CobranaDeeplink = { key: string; label: string; url: string };

function readCobranaDeeplinks(meta: Record<string, unknown>): CobranaDeeplink[] {
  const raw = meta.cobrana_deeplinks;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (d): d is CobranaDeeplink =>
      Boolean(d) &&
      typeof d === "object" &&
      typeof (d as CobranaDeeplink).url === "string" &&
      typeof (d as CobranaDeeplink).key === "string",
  );
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (
    !hasPermission(session.permissions, "payments:read") &&
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const { id } = await context.params;

  const actingAsCliente = await getActingAsCliente(session.id);
  const selected = await getSelectedHecomCliente(session.id);
  const hecomClienteId = selected?.id ?? null;
  const clienteOrgId = hecomClienteId
    ? await resolveOrganizationIdForHecomCliente(hecomClienteId)
    : null;
  const organizationId =
    (actingAsCliente || Boolean(hecomClienteId)) && clienteOrgId
      ? clienteOrgId
      : session.organizationId;

  if (!organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  const intent = await getPaymentIntentById(id, organizationId);
  if (!intent) {
    return NextResponse.json({ error: "Intención no encontrada." }, { status: 404 });
  }

  const meta = intent.metadata ?? {};
  const cobranaCode =
    typeof meta.cobrana_code === "string" ? meta.cobrana_code : null;
  const cobranaDeeplinks = readCobranaDeeplinks(meta);
  const creditCents =
    typeof meta.credit_amount_cents === "number" ? meta.credit_amount_cents : null;
  const grossPenCents =
    typeof meta.gross_pen_cents === "number" ? meta.gross_pen_cents : null;

  return NextResponse.json({
    ok: true,
    paymentIntent: {
      id: intent.id,
      status: intent.status,
      amountCents: intent.amountCents,
      currency: intent.currency,
      provider: intent.provider,
      checkoutUrl: intent.checkoutUrl,
      creditCents,
      grossPenCents,
      cobranaCode,
      cobranaDeeplinks,
    },
  });
}
