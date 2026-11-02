import type { UnitEconomics } from "./credit";
export type CostOrder = { status_cod: string | null; collected_amount: number | string | null; product_cost_amount: number | string | null; courier_cost_amount: number | string | null; currency: string | null };
/** Zero cost in the current schema is not proof that fulfilment or stock is free. */
export function summarizeKnownCosts(orders: CostOrder[], currency: string, adSpendUsd: number | null) {
  const values: Partial<UnitEconomics> = {};
  const missing: string[] = [];
  const collected = orders.filter((order) => order.status_cod === "collected");
  if (!collected.length) return { values, missing: ["No hay pedidos cobrados en el período para calcular costos por venta."], orders: orders.length, collected: 0 };
  if (orders.some((order) => order.currency?.toUpperCase() !== currency)) return { values, missing: ["Hay pedidos con moneda diferente o no identificada. No se mezclaron importes."], orders: orders.length, collected: collected.length };
  const amount = (value: unknown) => value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1_000_000_000 ? Math.round(Number(value) * 100) : null;
  function average(rows: CostOrder[], key: "collected_amount" | "product_cost_amount" | "courier_cost_amount", target: keyof UnitEconomics, label: string) {
    const cents = rows.map((row) => amount(row[key]));
    if (cents.some((value) => value === null)) { missing.push(`${label}: hay importes vacíos o cero sin confirmar.`); return; }
    values[target] = Math.round(cents.reduce<number>((sum, value) => sum + value!, 0) / collected.length);
  }
  average(collected, "collected_amount", "netSale", "Importe cobrado");
  average(collected, "product_cost_amount", "product", "Costo del producto");
  average(orders, "courier_cost_amount", "fulfillment", "Mensajería (incluye pedidos no cobrados)");
  if (currency === "USD" && adSpendUsd !== null && Number.isFinite(adSpendUsd) && adSpendUsd > 0) values.ads = Math.round(adSpendUsd * 100 / collected.length);
  else missing.push("CPA por venta cobrada: falta gasto compatible en USD o conversión de moneda verificada.");
  missing.push("Comisiones, impuestos no descontados, empaque y otros costos no cubiertos: requieren confirmación.");
  return { values, missing, orders: orders.length, collected: collected.length };
}
