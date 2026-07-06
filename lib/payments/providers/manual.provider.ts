import { serverEnv } from "@/lib/env/env.server";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProviderAdapter,
} from "./types";

export class ManualPaymentProvider implements PaymentProviderAdapter {
  id = "manual" as const;

  isConfigured(): boolean {
    return (
      !serverEnv.isProduction ||
      serverEnv.paymentsAllowManualProvider ||
      serverEnv.paymentsManualEnabled
    );
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    void input;
    return {
      providerReference: null,
      checkoutUrl: null,
      status: "requires_payment",
      message:
        "Depósito manual registrado. Realiza la transferencia y nuestro equipo confirmará el abono. El saldo no se acredita automáticamente.",
    };
  }
}
