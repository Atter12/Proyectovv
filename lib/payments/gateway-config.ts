import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";
import { serverEnv } from "@/lib/env/env.server";
import { STRIPE_PAYMENTS_ENABLED } from "@/lib/payments/stripe-policy";

const STRIPE_ACTIVE = STRIPE_PAYMENTS_ENABLED && Boolean(serverEnv.stripeSecretKey);

/**
 * Gateways visibles en Pagos.
 * Stripe (solo con STRIPE_PAYMENTS_ENABLED + clave) + Whop + Yape/Plin + Pago manual + Cripto.
 * Culqi / Mercado Pago ocultos.
 */
export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  ...(STRIPE_ACTIVE
    ? [{ id: "stripe", name: "Tarjeta", description: "Visa, Mastercard y más · pago seguro con Stripe" } as PaymentGateway]
    : []),
  {
    id: "whop",
    name: "Whop",
    description: "Tarjeta, Apple Pay y wallets globales",
    // Whop cayó (checkout sin métodos de pago). Quitar al terminar el mantenimiento.
    maintenance: true,
  },
  {
    id: "cobrana",
    name: "Yape / Plin",
    description: "Paga con Yape, Plin o transferencia bancaria",
  },
  {
    id: "manual",
    name: "Transferencia o Binance",
    description: "BCP: validación automática · Binance: revisión",
  },
  {
    id: "crypto",
    name: "Cripto (USDT)",
    description: "USDT TRC20 · pago automático con NOWPayments",
  },
];

export function isGatewayInMaintenance(id: PaymentGatewayId): boolean {
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
