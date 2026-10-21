/**
 * Stripe (LLC de Stripe Atlas). Apagado salvo que STRIPE_PAYMENTS_ENABLED=true
 * y haya STRIPE_SECRET_KEY: la cuenta anterior la cerró Stripe el 05/10/2026.
 */
export const STRIPE_PAYMENTS_ENABLED =
  process.env.STRIPE_PAYMENTS_ENABLED?.trim().toLowerCase() === "true";
/**
 * Mientras se prueba la cuenta nueva, Stripe solo aparece para staff y super admin
 * (identidad real, aunque esté "viendo como" cliente). Abrir a clientes: STRIPE_STAFF_ONLY=false.
 */
export const STRIPE_STAFF_ONLY =
  process.env.STRIPE_STAFF_ONLY?.trim().toLowerCase() !== "false";
export const STRIPE_STAFF_ONLY_MESSAGE =
  "El pago con tarjeta aún no está disponible. Elige otro método de pago.";

export function canUseStripe(identity: { isStaff: boolean; isSuperAdmin: boolean }): boolean {
  return !STRIPE_STAFF_ONLY || identity.isStaff || identity.isSuperAdmin;
}

export const STRIPE_DISABLED_MESSAGE =
  "Los pagos con Stripe están deshabilitados. Elige otro método de pago o contacta con soporte.";

export function assertStripePaymentsEnabled(): void {
  if (!STRIPE_PAYMENTS_ENABLED) throw new Error(STRIPE_DISABLED_MESSAGE);
}
