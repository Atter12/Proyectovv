import type { PaymentGatewayId } from "@/types/payment";
import { CobranaPaymentProvider } from "./cobrana.provider";
import { CryptoPaymentProvider } from "./crypto.provider";
import { CulqiPaymentProvider } from "./culqi.provider";
import { ManualPaymentProvider } from "./manual.provider";
import { MercadoPagoPaymentProvider } from "./mercadopago.provider";
import { StripePaymentProvider } from "./stripe.provider";
import { WhopPaymentProvider } from "./whop.provider";
import type { PaymentProviderAdapter } from "./types";

const providers: Record<PaymentGatewayId, PaymentProviderAdapter> = {
  stripe: new StripePaymentProvider(),
  culqi: new CulqiPaymentProvider(),
  mercadopago: new MercadoPagoPaymentProvider(),
  manual: new ManualPaymentProvider(),
  crypto: new CryptoPaymentProvider(),
  cobrana: new CobranaPaymentProvider(),
  whop: new WhopPaymentProvider(),
};

export function getPaymentProvider(provider: PaymentGatewayId): PaymentProviderAdapter {
  return providers[provider];
}

export function isProviderConfigured(provider: PaymentGatewayId): boolean {
  return getPaymentProvider(provider).isConfigured();
}

export function getConfiguredProviders(): PaymentGatewayId[] {
  return (Object.keys(providers) as PaymentGatewayId[]).filter((id) =>
    providers[id].isConfigured(),
  );
}

export { ProviderNotConfiguredError } from "./types";
export { CryptoAmountTooSmallError } from "./crypto.provider";
