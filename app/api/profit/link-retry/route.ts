import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import {
  autoLinkRpStoreForCliente,
  normalizeShopDomain,
  resolveShopDomainFromCodPayment,
} from "@/lib/realprofit/profit-snapshot.server";

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

  // Un dominio escrito a mano no prueba que la tienda sea del cliente (podría ver
  // lo que cobra otro negocio). Solo staff puede vincular así; el cliente vincula
  // instalando con el link firmado (installUrl en /api/profit).
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const isStaff =
    (funding.isStaff || funding.isSuperAdmin) &&
    !(await getActingAsCliente(session.id));

  let bodyShop: string | null = null;
  try {
    const body = (await request.json()) as { shopDomain?: string };
    bodyShop =
      isStaff && typeof body.shopDomain === "string" && body.shopDomain.trim()
        ? normalizeShopDomain(body.shopDomain)
        : null;
  } catch {
    bodyShop = null;
  }

  const fromPayment = await resolveShopDomainFromCodPayment(selected.id);
  const shopDomain = bodyShop || fromPayment;
  if (!shopDomain) {
    const linked = await autoLinkRpStoreForCliente({
      hecomClienteId: selected.id,
    });
    if (linked.linkedStoreId) {
      return NextResponse.json({
        ok: true,
        linked: true,
        alreadyLinked: true,
        storeId: linked.linkedStoreId,
        message: "Tienda vinculada. Ya puedes ver cobrado COD en Profit.",
      });
    }
    return NextResponse.json(
      {
        error:
          "Todavía no vemos tu tienda. Toca Instalar en Shopify, acepta los permisos y vuelve aquí.",
        installHint: true,
      },
      { status: 404 },
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
