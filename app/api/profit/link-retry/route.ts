import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  autoLinkRpStoreForCliente,
  normalizeShopDomain,
  resolveShopDomainFromCodPayment,
} from "@/lib/realprofit/profit-snapshot.server";
import { getRealProfitSubscription } from "@/lib/realprofit/subscription.server";

export const runtime = "nodejs";

/**
 * Cliente con COD activo: reintenta vincular la tienda Shopify
 * (útil si instalaron la app Real Profit después de pagar).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (
    !hasPermission(session.permissions, "adAccounts:read") &&
    !hasPermission(session.permissions, "wallet:deposit")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Selecciona un cliente primero." },
      { status: 400 },
    );
  }

  const sub = await getRealProfitSubscription(selected.id);
  if (!sub.isActive) {
    return NextResponse.json(
      {
        error:
          "Real Profit COD no está activo. Primero paga el +$20 y espera la aprobación.",
      },
      { status: 400 },
    );
  }

  let bodyShop: string | null = null;
  try {
    const body = (await request.json()) as { shopDomain?: string };
    bodyShop =
      typeof body.shopDomain === "string" && body.shopDomain.trim()
        ? normalizeShopDomain(body.shopDomain)
        : null;
  } catch {
    bodyShop = null;
  }

  const fromPayment = await resolveShopDomainFromCodPayment(selected.id);
  const shopDomain = bodyShop || fromPayment;
  if (!shopDomain) {
    return NextResponse.json(
      {
        error:
          "Falta el dominio de la tienda. Escribe mitienda.myshopify.com y reintenta.",
        needsShopDomain: true,
      },
      { status: 400 },
    );
  }

  try {
    const result = await autoLinkRpStoreForCliente({
      hecomClienteId: selected.id,
      shopDomain,
      userId: session.id,
    });

    if (!result.linkedStoreId) {
      return NextResponse.json(
        {
          ok: false,
          linked: false,
          shopDomain,
          error:
            "Todavía no encontramos esa tienda en Real Profit. Instala la app Shopify y espera unos segundos; después toca Vincular de nuevo.",
          installHint: true,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      linked: true,
      alreadyLinked: result.alreadyLinked,
      storeId: result.linkedStoreId,
      shopDomain,
      message: result.alreadyLinked
        ? "La tienda ya estaba vinculada."
        : "Tienda vinculada. Ya puedes ver cobrado COD en Profit.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo vincular la tienda.",
      },
      { status: 500 },
    );
  }
}
