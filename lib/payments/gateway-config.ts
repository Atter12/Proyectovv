import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Gateways visibles en Pagos.
 * Whop + Yape/Plin + Pago manual + Cripto (si hay API key).
 * Stripe queda en mantenimiento; Culqi / Mercado Pago ocultos.
 */
export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  {
    id: "whop",
    name: "Whop",
    description: "Tarjeta, Apple Pay y wallets globales",
  },
  {
    id: "cobrana",
    name: "Yape / Plin",
    description: "Paga con Yape, Plin o transferencia bancaria",
  },
  {
    id: "manual",
    name: "Pago manual",
    description: "Transferencia BCP · comprobante en revisión",
  },
  {
    id: "crypto",
    name: "Cripto (USDT)",
    description: "USDT TRC20 · pago automático con NOWPayments",
  },
];

export function isGatewayInMaintenance(id: PaymentGatewayId): boolean {
  if (id === "stripe") return true;
  return Boolean(PAYMENT_GATEWAYS.find((g) => g.id === id)?.maintenance);
}

export function getDefaultGatewayId(): PaymentGatewayId {
  const configured = serverEnv.paymentsDefaultProvider;
  const visible = PAYMENT_GATEWAYS.find((g) => g.id === configured && !g.maintenance);
  if (visible) return visible.id;

  const firstActive = PAYMENT_GATEWAYS.find((g) => !g.maintenance);
  return firstActive?.id ?? "manual";
}
