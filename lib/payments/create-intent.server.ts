import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/types/auth";
import {
  getPaymentProvider,
  ProviderNotConfiguredError,
} from "@/lib/payments/providers";
import {
  createPaymentIntentRecord,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import type { PaymentGatewayId } from "@/types/payment";
import { isPaymentGatewayId } from "@/types/payment";

export interface CreatePaymentIntentRequest {
  amount: number;
  currency?: string;
  provider: PaymentGatewayId;
  idempotencyKey?: string;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  status: string;
  provider: PaymentGatewayId;
  checkoutUrl: string | null;
  providerConfigured: boolean;
  message?: string;
}

export async function createPaymentIntentForSession(
  session: SessionUser,
  input: CreatePaymentIntentRequest,
): Promise<CreatePaymentIntentResponse> {
  if (!session.organizationId) {
    throw new Error("Organización no disponible en la sesión.");
  }

  if (!isPaymentGatewayId(input.provider)) {
    throw new Error("Proveedor de pago inválido.");
  }

  const amountCents = Math.round(input.amount * 100);
  if (amountCents <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }

  const currency = (input.currency ?? "USD").toUpperCase();
  const provider = input.provider;
  const providerImpl = getPaymentProvider(provider);
  const configured = providerImpl.isConfigured();

  if (!configured && provider !== "manual") {
    throw new ProviderNotConfiguredError(provider);
  }

  if (provider === "manual" && !configured) {
    throw new ProviderNotConfiguredError("manual");
  }

  const walletId = await resolveWalletId(session.organizationId);
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const intent = await createPaymentIntentRecord({
    organizationId: session.organizationId,
    walletId,
    amountCents,
    currency,
    provider,
    createdBy: session.id,
    idempotencyKey,
    metadata: { provider },
  });

  const checkoutResult = await providerImpl.createCheckout({
    amountCents,
    currency,
    organizationId: session.organizationId,
    walletId,
    paymentIntentId: intent.id,
    idempotencyKey,
    customerEmail: session.email,
  });

  const nextStatus =
    provider === "manual"
      ? "requires_payment"
      : checkoutResult.status === "requires_payment"
        ? "requires_payment"
        : checkoutResult.status === "processing"
          ? "processing"
          : "created";

  await updatePaymentIntentRecord(intent.id, {
    status: nextStatus,
    providerReference: checkoutResult.providerReference,
    checkoutUrl: checkoutResult.checkoutUrl,
  });

  return {
    paymentIntentId: intent.id,
    status: nextStatus,
    provider,
    checkoutUrl: checkoutResult.checkoutUrl,
    providerConfigured: configured,
    message: checkoutResult.message,
  };
}

async function resolveWalletId(organizationId: string): Promise<string> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  if (!data?.id) {
    throw new Error("No se encontró cartera activa para la organización.");
  }
  return data.id;
}

export async function processSuccessfulPaymentIntent(input: {
  provider: PaymentGatewayId;
  providerReference?: string | null;
  paymentIntentId?: string;
  amountCents?: number;
  currency?: string;
  createdBy?: string;
  webhookEventId?: string;
}): Promise<void> {
  const {
    getPaymentIntentByProviderReference,
    getPaymentIntentByIdInternal,
    updatePaymentIntentRecord,
    postWalletTransaction,
  } = await import("@/lib/payments/payment-intents.server");

  const intent =
    (input.paymentIntentId
      ? await getPaymentIntentByIdInternal(input.paymentIntentId)
      : null) ??
    (input.providerReference
      ? await getPaymentIntentByProviderReference(
          input.provider,
          input.providerReference,
        )
      : null);

  if (!intent) {
    throw new Error("Payment intent no encontrado.");
  }

  if (intent.provider !== input.provider) {
    throw new Error("El provider del webhook no coincide con la intención.");
  }

  if (intent.status === "succeeded") return;

  if (
    input.amountCents !== undefined &&
    input.amountCents !== intent.amountCents
  ) {
    throw new Error("El monto del webhook no coincide con la intención.");
  }

  if (
    input.currency !== undefined &&
    input.currency.toUpperCase() !== intent.currency.toUpperCase()
  ) {
    throw new Error("La moneda del webhook no coincide con la intención.");
  }

  const idempotencyKey = input.webhookEventId
    ? `wallet_deposit_webhook_${input.webhookEventId}`
    : intent.idempotencyKey
      ? `wallet_deposit_${intent.idempotencyKey}`
      : `wallet_deposit_${intent.id}`;

  await postWalletTransaction({
    organizationId: intent.organizationId,
    walletId: intent.walletId,
    type: "deposit",
    amountCents: intent.amountCents,
    currency: intent.currency,
    status: "completed",
    description: `Depósito vía ${input.provider}`,
    externalReference: input.providerReference ?? intent.providerReference ?? intent.id,
    idempotencyKey,
    createdBy: input.createdBy,
    metadata: {
      payment_intent_id: intent.id,
      provider: input.provider,
      webhook_event_id: input.webhookEventId ?? null,
    },
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "succeeded",
    succeededAt: new Date().toISOString(),
  });
}
