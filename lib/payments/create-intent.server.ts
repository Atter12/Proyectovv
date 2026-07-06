import { randomUUID } from "node:crypto";
import type { SessionUser } from "@/types/auth";
import {
  getPaymentProvider,
  ProviderNotConfiguredError,
} from "@/lib/payments/providers";
import {
  createPaymentIntentRecord,
  getPaymentIntentByIdInternal,
  getPaymentIntentByProviderReference,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { confirmDepositInLedger } from "@/lib/ledger/ledger.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/email.server";
import {
  manualPaymentCreatedTemplate,
  paymentSucceededTemplate,
} from "@/lib/email/templates/payments";
import { serverEnv } from "@/lib/env/env.server";
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
    metadata: { provider, source: "dashboard" },
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

  if (provider === "manual") {
    await sendManualPaymentEmailBestEffort({
      to: session.email,
      userId: session.id,
      organizationId: session.organizationId,
      paymentIntentId: intent.id,
      amountCents,
      currency,
    });
  }

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

async function getUserEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle<{ email: string }>();
  return data?.email ?? null;
}

async function sendManualPaymentEmailBestEffort(input: {
  to: string;
  userId: string;
  organizationId: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
}): Promise<void> {
  try {
    const template = manualPaymentCreatedTemplate({
      appName: serverEnv.appName,
      amountCents: input.amountCents,
      currency: input.currency,
      dashboardUrl: `${serverEnv.appUrl}/payments`,
    });

    await sendTransactionalEmail({
      to: input.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      templateKey: "payment.manual.created",
      organizationId: input.organizationId,
      userId: input.userId,
      idempotencyKey: `email:payment_manual_created:${input.paymentIntentId}`,
      metadata: { payment_intent_id: input.paymentIntentId },
    });
  } catch (error) {
    console.error("[email] manual payment email failed", error);
  }
}

async function sendPaymentSucceededEmailBestEffort(input: {
  to: string | null;
  userId: string | null;
  organizationId: string;
  paymentIntentId: string;
  provider: string;
  amountCents: number;
  currency: string;
}): Promise<void> {
  if (!input.to) return;
  try {
    const template = paymentSucceededTemplate({
      appName: serverEnv.appName,
      amountCents: input.amountCents,
      currency: input.currency,
      provider: input.provider,
      dashboardUrl: `${serverEnv.appUrl}/payments`,
    });

    await sendTransactionalEmail({
      to: input.to,
      subject: template.subject,
      html: template.html,
      text: template.text,
      templateKey: "payment.deposit.succeeded",
      organizationId: input.organizationId,
      userId: input.userId,
      idempotencyKey: `email:payment_succeeded:${input.paymentIntentId}`,
      metadata: { payment_intent_id: input.paymentIntentId, provider: input.provider },
    });
  } catch (error) {
    console.error("[email] payment success email failed", error);
  }
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

  const ledgerJournalId = await confirmDepositInLedger({
    paymentIntentId: intent.id,
    providerReference: input.providerReference ?? intent.providerReference,
    webhookEventId: input.webhookEventId,
    metadata: {
      provider: input.provider,
      webhook_event_id: input.webhookEventId ?? null,
      provider_reference: input.providerReference ?? intent.providerReference,
    },
  });

  const to = await getUserEmail(intent.createdBy);
  await sendPaymentSucceededEmailBestEffort({
    to,
    userId: intent.createdBy,
    organizationId: intent.organizationId,
    paymentIntentId: intent.id,
    provider: input.provider,
    amountCents: intent.amountCents,
    currency: intent.currency,
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "succeeded",
    succeededAt: new Date().toISOString(),
    metadata: {
      ...intent.metadata,
      ledger_journal_id: ledgerJournalId,
      provider_reference: input.providerReference ?? intent.providerReference,
    },
  });
}
