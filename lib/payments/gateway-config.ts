import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Gateways visibles en Pagos.
 * Stripe + Pago manual (BCP). Culqi / Mercado Pago / Cripto ocultos.
 */
export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Tarjetas y pagos globales",
  },
  {
    id: "manual",
    name: "Pago manual",
    description: "Transferencia BCP · temporalmente deshabilitado",
    maintenance: true,
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
