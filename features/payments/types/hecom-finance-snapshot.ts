/** KPIs Hecom del cliente operativo (sidebar / Pagos / fondeo). */
export type HecomBillingModality = "credito" | "prepago";

export type HecomFinanceSnapshot = {
  saldoEstimado: number;
  cobroTotal: number;
  gastoTotal: number;
  feeTotal: number;
  /** % Holistic del cliente según Hecom Club. */
  depositFeePercent: number;
  /** Crédito (ficha Hecom) vs prepago (sin formulario de crédito). */
  billingModality: HecomBillingModality;
  cobranzaRango: string | null;
};
