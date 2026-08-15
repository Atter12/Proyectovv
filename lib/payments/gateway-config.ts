import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";
import { serverEnv } from "@/lib/env/env.server";

export const PAYMENT_GATEWAYS: PaymentGateway[] = [
  {
    id: "stripe",
    name: "Stripe",
    description: "Tarjetas y pagos globales",
  },
  {
    id: "culqi",
    name: "Culqi",
    description: "Pagos con tarjeta en Perú",
  },
  {
    id: "mercadopago",
    name: "Mercado Pago",
    description: "Pagos en Latinoamérica",
  },
  {
    id: "crypto",
    name: "Cripto (USDT)",
    description: "Solo USDT (TRC20) · checkout NOWPayments o comprobante",
  },
  {
    id: "manual",
    name: "Pago manual",
    description: "Transferencia bancaria revisada por el equipo",
  },
];

export function getDefaultGatewayId(): PaymentGatewayId {
  const configured = serverEnv.paymentsDefaultProvider;
  if (
    configured === "stripe" ||
    configured === "culqi" ||
    configured === "mercadopago" ||
    configured === "manual" ||
    configured === "crypto"
  ) {
    return configured;
  }
  return "manual";
}
