import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getLinkedStoresForCliente } from "@/lib/realprofit/profit-snapshot.server";

/**
 * Cliente seleccionado + tienda Real Profit vinculada a él.
 * Sin storeId usa la primera tienda vinculada.
 */
export async function resolveLinkedRpStore(
  storeId: string | undefined,
): Promise<
  | { ok: true; hecomClienteId: string; storeId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  }
  if (!hasPermission(session.permissions, "adAccounts:read")) {
    return { ok: false, response: NextResponse.json({ error: "Permiso denegado." }, { status: 403 }) };
  }
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 }),
    };
  }
  const stores = await getLinkedStoresForCliente(selected.id);
  const store = storeId ? stores.find((s) => s.id === storeId) : stores[0];
  if (!store) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Primero conecta tu tienda Shopify." },
        { status: 400 },
      ),
    };
  }
  return { ok: true, hecomClienteId: selected.id, storeId: store.id };
}
