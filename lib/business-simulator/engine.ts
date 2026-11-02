/** Monthly agency economics. All money is integer cents; rates are basis points.
 * Media spend is never counted as agency revenue. Rules v1: half-up rounding.
 */
export const RULES_VERSION = "business-month-v1";
export const MAX_MONEY = 100_000_000_000;
export type Assumptions = {
  volume: number; feeBps: number; variableBps: number; fixed: number;
  collectedBps: number; variablePaidBps: number; fixedPaidBps: number;
};
export type Scenario = { name: string; inputs: Assumptions };
export type Model = {
  version: typeof RULES_VERSION; currency: "USD" | "PEN"; month: string;
  source: string; cutoff: string; notes: string; example: boolean;
  scenarios: [Scenario, Scenario, Scenario];
};
const round = (amount: number, rate: number) => Number((BigInt(amount) * BigInt(rate) + BigInt(5000)) / BigInt(10000));
export function validateInputs(input: Assumptions): string[] {
  const errors: string[] = [];
  for (const key of ["volume", "fixed"] as const) {
    if (!Number.isSafeInteger(input[key]) || input[key] < 0 || input[key] > MAX_MONEY) errors.push(`${key}: importe inválido.`);
  }
  for (const key of ["feeBps", "variableBps", "collectedBps", "variablePaidBps", "fixedPaidBps"] as const) {
    if (!Number.isInteger(input[key]) || input[key] < 0 || input[key] > 10000) errors.push(`${key}: porcentaje fuera de 0–100%.`);
  }
  return errors;
}
export function calculate(input: Assumptions) {
  const errors = validateInputs(input);
  if (errors.length) throw new Error(errors.join(" "));
  const fee = round(input.volume, input.feeBps);
  const variableCost = round(input.volume, input.variableBps);
  const collected = round(fee, input.collectedBps);
  const paidCosts = round(variableCost, input.variablePaidBps) + round(input.fixed, input.fixedPaidBps);
  return {
    fee, variableCost, totalCost: variableCost + input.fixed,
    operating: fee - variableCost - input.fixed, collected,
    receivable: fee - collected, paidCosts,
    payable: variableCost + input.fixed - paidCosts,
    cashFlow: collected - paidCosts,
  };
}
/** Conservative whole-cent media volume preserving the target operating result.
 * Corrects the closed formula for independent cent rounding of fee and cost.
 */
export function requiredVolume(input: Assumptions, target: number): number | null {
  if (validateInputs(input).length || !Number.isSafeInteger(target)) throw new Error("Supuestos inválidos.");
  const margin = input.feeBps - input.variableBps;
  if (margin <= 0) return null;
  if (target + input.fixed <= 0) return 0;
  const numerator = BigInt(target + input.fixed) * BigInt(10000);
  let cents = Number((numerator + BigInt(margin) - BigInt(1)) / BigInt(margin));
  if (cents > MAX_MONEY) return null;
  // Independent rounding can introduce a one-cent difference in profit.
  // Advance if rounding requires additional cents to meet the target.
  while (cents <= MAX_MONEY && calculate({ ...input, volume: cents }).operating < target) cents++;
  return cents <= MAX_MONEY ? cents : null;
}
export function createExample(month: string, cutoff: string): Model {
  const inputs: Assumptions = { volume: 20_000_000, feeBps: 500, variableBps: 50, fixed: 600_000, collectedBps: 8000, variablePaidBps: 10000, fixedPaidBps: 10000 };
  return { version: RULES_VERSION, currency: "USD", month, cutoff,
    source: "Ejemplo ficticio de la propuesta Hecom, octubre de 2026",
    notes: "Supuestos inventados. Sin impuestos, saldos iniciales, financiación de medios ni conversión de moneda.", example: true,
    scenarios: [
      { name: "Base", inputs: { ...inputs } },
      { name: "Expansión", inputs: { ...inputs, volume: 25_000_000 } },
      { name: "Nueva tarifa", inputs: { ...inputs, volume: 25_000_000, feeBps: 450 } },
    ],
  };
}
export function parseModel(value: unknown): Model {
  if (!value || typeof value !== "object") throw new Error("La ficha no tiene un formato válido.");
  const model = value as Model;
  if (model.version !== RULES_VERSION) throw new Error("La versión de esta ficha no es compatible. Conserva el archivo original.");
  if (!["USD", "PEN"].includes(model.currency) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(model.month) || !/^\d{4}-\d{2}-\d{2}$/.test(model.cutoff)) throw new Error("Revisa moneda, período y fecha de corte.");
  const date = new Date(`${model.cutoff}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== model.cutoff) throw new Error("La fecha de corte no existe en el calendario.");
  if (!Array.isArray(model.scenarios) || model.scenarios.length !== 3) throw new Error("La ficha debe contener tres escenarios.");
  for (const scenario of model.scenarios) {
    if (!scenario || typeof scenario.name !== "string" || !scenario.name.trim() || scenario.name.length > 80 || !scenario.inputs || validateInputs(scenario.inputs).length) throw new Error("Un escenario tiene supuestos inválidos.");
  }
  for (const text of [model.source, model.notes]) if (typeof text !== "string" || text.length > 4000) throw new Error("La referencia o las notas no son válidas.");
  if (typeof model.example !== "boolean") throw new Error("Falta identificar el origen de los supuestos.");
  return model;
}
