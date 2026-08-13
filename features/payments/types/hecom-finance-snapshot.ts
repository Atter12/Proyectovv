/** KPIs Hecom del cliente operativo (sidebar / Pagos / fondeo). */
export type HecomFinanceSnapshot = {
  saldoEstimado: number;
  cobroTotal: number;
  gastoTotal: number;
  feeTotal: number;
  /** % Holistic del cliente según Hecom Club. */
  depositFeePercent: number;
};
