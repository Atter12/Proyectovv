import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  callRealProfitApi,
  ensureRealProfitAdsStore,
} from "@/lib/realprofit/install-link.server";

export const runtime = "nodejs";

/**
 * Meta en modo socio: el cliente compartió su cuenta publicitaria con nuestro
 * Business; Real Profit la valida, la vincula y jala 30 días de gasto.
 * No exige Shopify: sin tienda, Real Profit usa una «solo ads» que se muda sola
 * a la tienda real cuando la instale.
 * POST { adAccountId }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!hasPermission(session.permissions, "adAccounts:read")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { adAccountId?: string };

  const store = await ensureRealProfitAdsStore(selected.id, selected.name);
  if ("error" in store) {
    return NextResponse.json({ error: store.error }, { status: store.status });
  }

  const res = await callRealProfitApi<{ message?: string; accountName?: string }>(
    "/api/ads/meta/partner",
    selected.id,
    { storeId: store.storeId, adAccountId: body.adAccountId ?? "" },
  );
  return NextResponse.json(
    res.ok ? { ok: true, ...res.data } : { error: res.data.error ?? "No se pudo conectar Meta." },
    { status: res.ok ? 200 : res.status },
  );
}
