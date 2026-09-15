import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Gateways visibles en Pagos.
 * Stripe + Yape/Plin + Pago manual + Cripto (USDT / NOWPayments).
 * Culqi / Mercado Pago ocultos.
 */
export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Tarjetas y pagos globales",
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
  return Boolean(PAYMENT_GATEWAYS.find((g) => g.id === id)?.maintenance);
}

export function getDefaultGatewayId(): PaymentGatewayId {
  const configured = serverEnv.paymentsDefaultProvider;
  const visible = PAYMENT_GATEWAYS.find((g) => g.id === configured && !g.maintenance);
  if (visible) return visible.id;

  const firstActive = PAYMENT_GATEWAYS.find((g) => !g.maintenance);
  return firstActive?.id ?? "stripe";
}
