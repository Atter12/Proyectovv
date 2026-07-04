import { serverEnv } from "@/lib/env/env.server";
import {
  ProviderNotConfiguredError,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type PaymentProviderAdapter,
} from "./types";

export class CulqiPaymentProvider implements PaymentProviderAdapter {
  id = "culqi" as const;

  isConfigured(): boolean {
    return Boolean(serverEnv.culqiSecretKey);
  }

  async createCheckout(_input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError("culqi");
    }

    return {
      providerReference: null,
      checkoutUrl: null,
      status: "requires_payment",
      message:
        "Culqi está configurado parcialmente. Completa la integración de checkout en el adapter.",
    };
  }
}
