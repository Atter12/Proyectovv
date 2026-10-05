/** Emergency shutdown: cannot be overridden by environment configuration. */
export const STRIPE_PAYMENTS_ENABLED = false;
export const STRIPE_DISABLED_MESSAGE =
  "Los pagos con Stripe están deshabilitados. Elige otro método de pago o contacta con soporte.";

export function assertStripePaymentsEnabled(): void {
  if (!STRIPE_PAYMENTS_ENABLED) throw new Error(STRIPE_DISABLED_MESSAGE);
}
