import { serverEnv } from "@/lib/env/env.server";
import {
  createCobranaCharge,
  isCobranaConfigured,
  verifyCobranaWebhookSignature,
  type CobranaCharge,
} from "@/lib/payments/cobrana/client.server";
import { COBRANA_YAPE_SERVICE_COMPANY } from "@/lib/payments/cobrana/service-brand";
import {
  ProviderNotConfiguredError,
  type CreateCheckoutInput,
  type CreateCheckoutResult,
  type PaymentProviderAdapter,
  type VerifiedWebhookEvent,
  type VerifyWebhookInput,
} from "./types";

type CobranaWebhookPayload = {
  id?: string;
  type?: string;
  data?: {
    object?: CobranaCharge;
  };
};

function splitPersonName(fullName: string | undefined): {
  name?: string;
  lastname?: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { name: parts[0] };
  return {
    name: parts[0],
    lastname: parts.slice(1).join(" "),
  };
}

export class CobranaPaymentProvider implements PaymentProviderAdapter {
  id = "cobrana" as const;

  isConfigured(): boolean {
    return isCobranaConfigured();
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    if (!this.isConfigured()) {
      throw new ProviderNotConfiguredError("cobrana");
    }

    const docRaw = input.customerDocumentNumber?.trim();
    if (!docRaw) {
      throw new Error(
        "Falta el DNI/RUC del cliente en Hecom para pagar con Yape.",
      );
    }

    const { normalizeYapeDocument } = await import(
      "@/lib/payments/cobrana/document.server"
    );
    const doc = normalizeYapeDocument(docRaw);
    if (!doc.ok) {
      throw new Error(doc.message);
    }

    if (input.currency.toUpperCase() !== "PEN") {
      throw new Error("Yape solo acepta cargos en PEN.");
    }

    const amountPen = input.amountCents / 100;
    if (!(amountPen >= 10)) {
      throw new Error("El monto mínimo en Yape es S/ 10.");
    }

    const fromInput = {
      name: input.customerName?.trim() || undefined,
      lastname: input.customerLastname?.trim() || undefined,
    };
    const fromEmailName =
      !fromInput.name && !fromInput.lastname
        ? splitPersonName(
            typeof input.metadata?.customer_full_name === "string"
              ? input.metadata.customer_full_name
              : undefined,
          )
        : {};

    const charge = await createCobranaCharge({
      amountPen,
      concept:
        input.concept?.trim() ||
        `Recarga cartera Holistic ${input.paymentIntentId.slice(0, 8)}`,
      documentNumber: doc.value.documentNumber,
      documentType:
        input.customerDocumentType ?? doc.value.documentType,
      name: fromInput.name ?? fromEmailName.name,
      lastname: fromInput.lastname ?? fromEmailName.lastname,
      email: input.customerEmail,
      phoneNumber:
        typeof input.metadata?.customer_phone === "string"
          ? input.metadata.customer_phone
          : undefined,
      externalRef: input.paymentIntentId,
      idempotencyKey: input.idempotencyKey,
      metadata: {
        organization_id: input.organizationId,
        wallet_id: input.walletId,
      },
    });

    const deeplinks = Array.isArray(charge.deeplinks) ? charge.deeplinks : [];
    const code = charge.code?.trim() || null;

    const messageParts = [
      code
        ? `En Yape → Pago de servicios → empresa ${COBRANA_YAPE_SERVICE_COMPANY} → código ${code}.`
        : `Orden creada. En Yape busca la empresa ${COBRANA_YAPE_SERVICE_COMPANY} en Pago de servicios.`,
      "Desde la computadora, consulta el código aquí y paga desde el celular.",
      "Cuando se confirme el pago, el saldo USD se acredita solo.",
    ].filter(Boolean);

    return {
      providerReference: charge.id,
      checkoutUrl: null,
      status: "requires_payment",
      message: messageParts.join(" "),
      resultMetadata: {
        cobrana_charge_id: charge.id,
        cobrana_code: code,
        cobrana_deeplinks: deeplinks,
        cobrana_option: charge.option ?? serverEnv.cobranaServicesOption,
        cobrana_method: charge.method ?? "services",
        charge_currency: "PEN",
      },
    };
  }

  async verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifiedWebhookEvent | null> {
    const signature =
      input.headers.get("x-cobrana-signature") ?? input.signature;

    if (serverEnv.isProduction || serverEnv.cobranaWebhookSecret) {
      if (
        !verifyCobranaWebhookSignature(
          input.rawBody,
          signature,
          serverEnv.cobranaWebhookSecret,
        )
      ) {
        return null;
      }
    }

    let payload: CobranaWebhookPayload;
    try {
      payload = JSON.parse(input.rawBody) as CobranaWebhookPayload;
    } catch {
      return null;
    }

    const eventId = payload.id?.trim();
    const eventType = payload.type?.trim() || "unknown";
    if (!eventId) return null;

    const charge = payload.data?.object;
    const providerReference = charge?.id?.trim() || null;
    const meta = charge?.metadata;
    const paymentIntentId =
      (typeof meta?.payment_intent_id === "string"
        ? meta.payment_intent_id
        : null) ||
      (typeof charge?.externalRef === "string" ? charge.externalRef : null) ||
      undefined;

    const status = String(charge?.status ?? "").toLowerCase();
    const succeeded =
      eventType === "charge.paid" || status === "paid";
    const failed =
      eventType === "charge.failed" ||
      status === "failed" ||
      status === "expired";
    const cancelled =
      eventType === "charge.cancelled" ||
      eventType === "charge.canceled" ||
      status === "cancelled" ||
      status === "canceled";

    const amountPen =
      typeof charge?.amount === "number" && Number.isFinite(charge.amount)
        ? charge.amount
        : null;

    return {
      eventId,
      eventType,
      providerReference,
      paymentIntentId,
      amountCents:
        amountPen != null ? Math.round(amountPen * 100) : undefined,
      currency: charge?.currency?.toUpperCase() ?? "PEN",
      succeeded,
      failed,
      cancelled,
    };
  }
}
