import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { getActingAsCliente, getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultProfitDateRange } from "@/lib/realprofit/db.server";
import { getLinkedStoresForCliente } from "@/lib/realprofit/profit-snapshot.server";
import { loadHolisticTikTokSpendForCliente } from "@/lib/realprofit/holistic-spend.server";
import { summarizeKnownCosts, type CostOrder } from "@/lib/business-simulator/known-costs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.profileStatus !== "active") return reply({ error: "Inicia sesión para consultar costos." }, 401);
  const access = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if ((!access.isStaff && !access.isSuperAdmin) || await getActingAsCliente(session.id)) return reply({ error: "Consulta disponible solo para gerencia." }, 403);
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) return reply({ error: "Selecciona un cliente en Clientes antes de consultar sus costos." }, 400);
  const currency = new URL(request.url).searchParams.get("currency") ?? "USD";
  if (currency !== "USD" && currency !== "PEN") return reply({ error: "Moneda no compatible." }, 400);
  try {
    const stores = (await getLinkedStoresForCliente(selected.id)).filter((store) => store.isActive);
    const range = defaultProfitDateRange();
    if (!stores.length) return reply({ clientId: selected.id, client: selected.name, currency, ...range, values: {}, missing: ["El cliente no tiene una tienda activa vinculada a Profit."], orders: 0, collected: 0 });
    if (stores.some((store) => store.currency.toUpperCase() !== currency)) return reply({ clientId: selected.id, client: selected.name, currency, ...range, values: {}, missing: ["La moneda de las tiendas no coincide con la evaluación. No se hizo una conversión automática."], orders: 0, collected: 0 });
    const admin = createAdminClient();
    const orders: CostOrder[] = [];
    // Service-role reads are constrained by the selected, authorized customer's store links.
    for (let offset = 0; offset <= 10000; offset += 1000) {
      const result = await admin.from("rp_orders")
        .select("id,status_cod,collected_amount,product_cost_amount,courier_cost_amount,currency")
        .in("store_id", stores.map((store) => store.id))
        .gte("created_at", `${range.from}T00:00:00Z`).lte("created_at", `${range.to}T23:59:59.999Z`)
        .order("id").range(offset, offset + 999);
      if (result.error) throw new Error(result.error.message);
      if (offset === 10000 && result.data?.length) return reply({ error: "Hay más de 10.000 pedidos. Se requiere un agregado completo antes de evaluar." }, 422);
      orders.push(...(result.data ?? []) as CostOrder[]);
      if (!result.data || result.data.length < 1000) break;
    }
    const spend = orders.some((order) => order.status_cod === "collected") ? await loadHolisticTikTokSpendForCliente({ hecomClienteId: selected.id, ...range }) : null;
    return reply({ clientId: selected.id, client: selected.name, currency, ...range, ...summarizeKnownCosts(orders, currency, spend?.rows.length ? spend.adSpend : null), basis: "Pedidos creados en el período y con su estado actual al consultar; no equivale a fecha real de cobro. Gasto publicitario del mismo período. Los costos por venta son promedios, no de un producto individual." });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "No se pudieron consultar los costos del cliente." }, 502); }
}
