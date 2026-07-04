import { serverEnv } from "@/lib/env/env.server";
import {
  ProviderNotConfiguredError,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type PaymentProviderAdapter,
  type VerifiedWebhookEvent,
  type VerifyWebhookInput,
} from "./types";

export class MercadoPagoPaymentProvider implements PaymentProviderAdapter {
  id = "mercadopago" as const;

  isConfigured(): boolean {
    return Boolean(serverEnv.mercadoPagoAccessToken);
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError("mercadopago");
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv.mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            title: "Recarga de cartera",
            quantity: 1,
            unit_price: input.amountCents / 100,
            currency_id: input.currency,
          },
        ],
        external_reference: input.paymentIntentId,
        metadata: {
          payment_intent_id: input.paymentIntentId,
          organization_id: input.organizationId,
        },
        back_urls: {
          success: `${serverEnv.appUrl}/payments?tab=wallet-tx&status=success`,
          failure: `${serverEnv.appUrl}/payments?tab=wallet-tx&status=failed`,
          pending: `${serverEnv.appUrl}/payments?tab=wallet-tx&status=pending`,
        },
        auto_return: "approved",
      }),
    });

    const data = (await response.json()) as {
      id?: string;
      init_point?: string;
      message?: string;
    };

    if (!response.ok || !data.id) {
      throw new Error(data.message ?? "No se pudo crear la preferencia de Mercado Pago.");
    }

    return {
      providerReference: data.id,
      checkoutUrl: data.init_point ?? null,
      status: "requires_payment",
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent | null> {
    const secret = serverEnv.mercadoPagoWebhookSecret;
    if (serverEnv.isProduction && secret) {
      const headerSecret = input.headers.get("x-signature");
      if (!headerSecret || headerSecret !== secret) return null;
    }

    try {
      const data = JSON.parse(input.rawBody) as {
        id?: string | number;
        type?: string;
        action?: string;
        data?: { id?: string };
      };

      const eventId = String(data.id ?? "");
      if (!eventId) return null;

      return {
        eventId,
        eventType: data.type ?? data.action ?? "unknown",
        providerReference: data.data?.id ?? null,
        succeeded: data.action === "payment.updated" || data.type === "payment",
        failed: false,
        cancelled: false,
      };
    } catch {
      return null;
    }
  }
}
