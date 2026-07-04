import { unstable_cache } from "next/cache";
import {
  getDefaultGatewayId,
  PAYMENT_GATEWAYS,
} from "@/lib/payments/gateway-config";
import { CACHE_TAGS } from "@/lib/cache/tags";
import type { PaymentGateway, PaymentGatewayId } from "@/types/payment";

export const getCachedPaymentGateways = unstable_cache(
  async (): Promise<PaymentGateway[]> => PAYMENT_GATEWAYS,
  ["payment-gateways"],
  { revalidate: 3600, tags: [CACHE_TAGS.paymentGateways] },
);

export async function getCachedDefaultGatewayId(): Promise<PaymentGatewayId> {
  return getDefaultGatewayId();
}
