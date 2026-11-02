/** Decision support only. No default credit policy or automatic approval. */
export const CREDIT_VERSION = "credit-review-v2";
export type UnitEconomics = { netSale: number | null; product: number | null; fulfillment: number | null; ads: number | null; fees: number | null };
export function unitContribution(unit?: UnitEconomics): number | null {
  if (!unit || Object.values(unit).some((value) => value === null || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000_000)) return null;
  return unit.netSale! - unit.product! - unit.fulfillment! - unit.ads! - unit.fees!;
}
export type CreditInput = {
  requested: number | null; debt: number | null; overdue: number | null;
  overdueDays: number | null; payments: number | null; onTime: number | null;
  dueAmount: number | null; cashAvailable: number | null;
};
export type CreditPolicy = {
  maxExposure: number | null; maxOverdueDays: number | null;
  minOnTimeBps: number | null; minPayments: number | null; minCoverageBps: number | null;
};
export function reviewCredit(input: CreditInput, policy: CreditPolicy, evidence: string, policyRef: string, unit?: UnitEconomics) {
  const missing: string[] = [];
  const contribution = unitContribution(unit);
  if (contribution === null) missing.push("Datos de rentabilidad por venta cobrada");
  if (!evidence.trim()) missing.push("Origen y fecha de los datos del cliente");
  if (!policyRef.trim()) missing.push("Referencia y versión de la política de Holistic");
  for (const [key, value] of Object.entries({ ...input, ...policy })) {
    if (value === null || !Number.isSafeInteger(value) || value < 0 || value > 100_000_000_000) missing.push(`Revisar ${key}`);
  }
  if (!input.requested || !input.dueAmount) missing.push("Solicitud y monto exigible deben ser mayores que cero");
  if (input.payments === 0) missing.push("Historial de pagos del cliente");
  if (input.onTime !== null && input.payments !== null && input.onTime > input.payments) missing.push("Los pagos puntuales no pueden superar los pagos totales");
  if (input.overdue !== null && input.debt !== null && input.overdue > input.debt) missing.push("La deuda vencida no puede superar la deuda total");
  if (input.overdue !== null && input.overdueDays !== null && ((input.overdue > 0 && input.overdueDays === 0) || (input.overdue === 0 && input.overdueDays > 0))) missing.push("La deuda vencida y los días de mora actual son inconsistentes");
  if (policy.minOnTimeBps !== null && policy.minOnTimeBps > 10000) missing.push("El mínimo de pagos puntuales no puede superar 100%");
  if (missing.length) return { status: "needs_data" as const, missing, checks: [], exposure: null, coverageBps: null, onTimeBps: null };
  const exposure = input.debt! + input.requested!;
  const coverageBps = Number(BigInt(input.cashAvailable!) * BigInt(10000) / BigInt(input.dueAmount!));
  const onTimeBps = Number(BigInt(input.onTime!) * BigInt(10000) / BigInt(input.payments!));
  const checks = [
    { label: "Exposición total dentro del límite", pass: exposure <= policy.maxExposure! },
    { label: "Mora dentro del máximo tolerado", pass: input.overdueDays! <= policy.maxOverdueDays! },
    { label: "Historial con suficientes pagos", pass: input.payments! >= policy.minPayments! },
    // Cross-products avoid accepting borderline ratios rounded to the threshold.
    { label: "Pagos puntuales según la política", pass: BigInt(input.onTime!) * BigInt(10000) >= BigInt(input.payments!) * BigInt(policy.minOnTimeBps!) },
    { label: "Efectivo disponible cubre el pago exigible", pass: BigInt(input.cashAvailable!) * BigInt(10000) >= BigInt(input.dueAmount!) * BigInt(policy.minCoverageBps!) },
    { label: "La venta deja contribución tras producto, entrega, comisiones y publicidad", pass: contribution! > 0 },
  ];
  return { status: checks.every((check) => check.pass) ? "within_policy" as const : "outside_policy" as const, missing, checks, exposure, coverageBps, onTimeBps };
}
