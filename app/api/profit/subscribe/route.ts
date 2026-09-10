import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { createRealProfitCodSubscribeIntent } from "@/lib/realprofit/create-subscribe-intent.server";
import {
  getRealProfitSubscription,
  REALPROFIT_COD_AMOUNT_USD,
} from "@/lib/realprofit/subscription.server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "adAccounts:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  try {
    const sub = await getRealProfitSubscription(selected.id);
    return NextResponse.json({
      ok: true,
      amountUsd: REALPROFIT_COD_AMOUNT_USD,
      subscription: sub,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la suscripción.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create") &&
    !hasPermission(session.permissions, "adAccounts:create")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Seleccioná un cliente primero." },
      { status: 400 },
    );
  }

  const organizationId = session.organizationId;
  if (!organizationId) {
    return NextResponse.json(
      { error: "Organización no disponible." },
      { status: 400 },
    );
  }

  let shopDomain: string | null = null;
  try {
    const body = (await request.json()) as { shopDomain?: string };
    shopDomain =
      typeof body.shopDomain === "string" ? body.shopDomain.trim() : null;
  } catch {
    shopDomain = null;
  }

  const existing = await getRealProfitSubscription(selected.id);
  if (existing.isActive) {
    return NextResponse.json({
      ok: true,
      alreadyActive: true,
      subscription: existing,
      message: "Real Profit COD ya está activo este período.",
    });
  }

  try {
    const result = await createRealProfitCodSubscribeIntent({
      session,
      hecomClienteId: selected.id,
      hecomClienteName: selected.name,
      organizationId,
      shopDomain,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear el pago de Real Profit COD.",
      },
      { status: 400 },
    );
  }
}
