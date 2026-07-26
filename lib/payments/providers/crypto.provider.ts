import { serverEnv } from "@/lib/env/env.server";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProviderAdapter,
} from "./types";

/**
 * Crypto deposit via USDT (Binance / wallet) + human review of proof.
 * Auto on-chain confirmation (NOWPayments, etc.) can replace this later.
 */
export class CryptoPaymentProvider implements PaymentProviderAdapter {
  id = "crypto" as const;

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
        "Recarga cripto registrada. Enviá USDT (red indicada por el equipo), subí el comprobante / TxID y esperá la confirmación. El saldo no se acredita solo.",
    };
  }
}
