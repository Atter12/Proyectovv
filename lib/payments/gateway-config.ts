import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";
import { serverEnv } from "@/lib/env/env.server";
import { STRIPE_PAYMENTS_ENABLED } from "@/lib/payments/stripe-policy";

const STRIPE_ACTIVE = STRIPE_PAYMENTS_ENABLED && Boolean(serverEnv.stripeSecretKey);

/**
 * Gateways visibles en Pagos.
 * Stripe (solo con STRIPE_PAYMENTS_ENABLED + clave), Yape/Plin, manual y cripto.
 * Whop retirado; NOWPayments visible en mantenimiento.
 */
export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  ...(STRIPE_ACTIVE
    ? [{ id: "stripe", name: "Tarjeta", description: "Visa, Mastercard y más · pago seguro con Stripe" } as PaymentGateway]
    : []),
  {
    id: "cobrana",
    name: "Yape / Plin",
    description: "Paga con Yape, Plin o transferencia bancaria",
  },
  {
    id: "manual",
    name: "Transferencia automática",
    description: "Transferencia a BCP · validación automática",
  },
  {
    id: "crypto",
    name: "Cripto (USDT)",
    description: "USDT TRC20 · pago automático con NOWPayments",
    maintenance: true,
  },
];

export function isGatewayInMaintenance(id: PaymentGatewayId): boolean {
  // Also reject direct API requests for the removed gateway.
  if (id === "whop") return true;
  if (id === "stripe") return !STRIPE_ACTIVE;
  return Boolean(PAYMENT_GATEWAYS.find((g) => g.id === id)?.maintenance);
}

export function getDefaultGatewayId(): PaymentGatewayId {
  const configured = serverEnv.paymentsDefaultProvider;
  const visible = PAYMENT_GATEWAYS.find((g) => g.id === configured && !g.maintenance);
  if (visible) return visible.id;

  const firstActive = PAYMENT_GATEWAYS.find((g) => !g.maintenance);
  return firstActive?.id ?? "manual";
}
