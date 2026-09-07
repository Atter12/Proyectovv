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
  claimPaymentIntentSucceeded,
  mergePaymentIntentMetadata,
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
import { resolveDepositFeeForSession } from "@/lib/payments/resolve-hecom-deposit-fee.server";
import {
  buildManualDepositQuote,
  type ManualChargeCurrency,
} from "@/lib/payments/manual-deposit.server";
import { isGatewayInMaintenance } from "@/lib/payments/gateway-config";
import type { PaymentGatewayId } from "@/types/payment";
import { isPaymentGatewayId, isVoucherPaymentProvider } from "@/types/payment";
import { syncWalletDepositCobroBestEffort } from "@/lib/hecom/wallet-cobro-bridge.server";

export interface CreatePaymentIntentRequest {
  /** Monto que el cliente quiere acreditar en cartera (neto USD). Se cobra bruto + fee. */
  amount: number;
  currency?: string;
  /** Moneda en la que transfiere (solo pago manual). */
  chargeCurrency?: ManualChargeCurrency;
  provider: PaymentGatewayId;
  idempotencyKey?: string;
  hecomClienteId?: string | null;
  /** Org de la cartera destino (cliente OTP al “ver como”); default = sesión. */
  organizationId?: string | null;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  status: string;
  provider: PaymentGatewayId;
  checkoutUrl: string | null;
  providerConfigured: boolean;
  message?: string;
  feePercent: number;
  feeCents: number;
  creditCents: number;
  grossCents: number;
  chargeCurrency?: ManualChargeCurrency;
  grossChargeCents?: number;
  grossPenCents?: number | null;
  fxRateUsdPen?: number;
  cobranaCode?: string | null;
  cobranaDeeplinks?: Array<{ key: string; label: string; url: string }>;
}

export async function createPaymentIntentForSession(
  session: SessionUser,
  input: CreatePaymentIntentRequest,
): Promise<CreatePaymentIntentResponse> {
  const organizationId =
    input.organizationId?.trim() || session.organizationId || null;
  if (!organizationId) {
    throw new Error("Organización no disponible en la sesión.");
  }

  if (!isPaymentGatewayId(input.provider)) {
    throw new Error("Proveedor de pago inválido.");
  }

  if (isGatewayInMaintenance(input.provider)) {
    throw new Error(
      "Este método de pago está en mantenimiento. Usá Stripe por ahora.",
    );
  }

  const creditCents = Math.round(input.amount * 100);
  if (creditCents <= 0) {
    throw new Error("El monto debe ser mayor a cero.");
  }

  const currency = (input.currency ?? "USD").toUpperCase();
  const provider = input.provider;
  const providerImpl = getPaymentProvider(provider);
  const configured = providerImpl.isConfigured();

  if (!configured && !isVoucherPaymentProvider(provider)) {
    throw new ProviderNotConfiguredError(provider);
  }

  if (isVoucherPaymentProvider(provider) && !configured) {
    throw new ProviderNotConfiguredError(provider);
  }

  const fee = await resolveDepositFeeForSession({
    userId: session.id,
    creditCents,
    hecomClienteId: input.hecomClienteId,
  });

  const isCobrana = provider === "cobrana";
  const chargeCurrency: ManualChargeCurrency =
    input.provider === "manual" && input.chargeCurrency === "PEN"
      ? "PEN"
      : isCobrana
        ? "PEN"
        : "USD";

  let amountCents = fee.grossCents;
  let intentCurrency = (input.currency ?? "USD").toUpperCase();
  let manualQuoteMeta: Record<string, unknown> = {};
  let cobranaCustomer: {
    documentNumber: string;
    name?: string;
    lastname?: string;
    phone?: string | null;
    fullName?: string | null;
  } | null = null;

  if (isCobrana || (input.provider === "manual" && chargeCurrency === "PEN")) {
    const quote = buildManualDepositQuote({
      creditUsd: input.amount,
      feePercent: fee.feePercent,
      chargeCurrency: "PEN",
    });
    amountCents = quote.grossChargeCents;
    intentCurrency = "PEN";
    manualQuoteMeta = {
      charge_currency: "PEN",
      fx_rate_usd_pen: quote.fxRateUsdPen,
      credit_pen_cents: quote.creditPenCents,
      gross_pen_cents: quote.grossPenCents,
      fee_pen_cents: quote.feePenCents,
      gross_usd_cents: quote.grossUsdCents,
    };
  } else if (input.provider === "manual") {
    manualQuoteMeta = {
      charge_currency: "USD",
      gross_usd_cents: fee.grossCents,
    };
  }

  if (isCobrana) {
    if (!fee.hecomClienteId) {
      throw new Error(
        "Seleccioná un cliente Hecom para pagar con Yape / Cobrana.",
      );
    }
    const { getHecomCliente } = await import("@/lib/hecom/clientes.server");
    const hecomCliente = await getHecomCliente(fee.hecomClienteId);
    const dni = hecomCliente?.dni?.trim() || null;
    if (!dni) {
      throw new Error(
        "Completá el DNI/RUC del cliente en Hecom CRM para pagar con Yape / Cobrana.",
      );
    }
    const nameParts = String(hecomCliente?.name ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    cobranaCustomer = {
      documentNumber: dni,
      name: nameParts[0],
      lastname: nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined,
      phone: hecomCliente?.phones?.[0] ?? null,
      fullName: hecomCliente?.name ?? null,
    };
    if (amountCents < 1000) {
      throw new Error(
        "Con el tipo de cambio actual el cargo en soles queda bajo el mínimo de Cobrana (S/ 10). Subí el monto en USD.",
      );
    }
  }

  if (amountCents <= 0) {
    throw new Error("El monto a cobrar debe ser mayor a cero.");
  }

  const walletId = await resolveWalletId(organizationId);
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const intent = await createPaymentIntentRecord({
    organizationId,
    walletId,
    amountCents,
    currency:
      input.provider === "manual" || isCobrana ? intentCurrency : currency,
    provider,
    createdBy: session.id,
    idempotencyKey,
    metadata: {
      provider,
      source: "dashboard",
      input_mode: "desired_credit",
      hecom_cliente_id: fee.hecomClienteId,
      hecom_cliente_name: fee.hecomClienteName,
      fee_percent: fee.feePercent,
      fee_source: fee.feeSource,
      fee_amount_cents: fee.feeCents,
      credit_amount_cents: fee.creditCents,
      gross_amount_cents: fee.grossCents,
      wallet_credit_currency: "USD",
      ...(cobranaCustomer
        ? {
            customer_document_number: cobranaCustomer.documentNumber,
            customer_full_name: cobranaCustomer.fullName,
            customer_phone: cobranaCustomer.phone,
          }
        : {}),
      ...manualQuoteMeta,
    },
  });

  const checkoutResult = await providerImpl.createCheckout({
    amountCents,
    currency:
      input.provider === "manual" || isCobrana ? intentCurrency : currency,
    organizationId,
    walletId,
    paymentIntentId: intent.id,
    idempotencyKey,
    customerEmail: session.email,
    customerDocumentNumber: cobranaCustomer?.documentNumber,
    customerName: cobranaCustomer?.name,
    customerLastname: cobranaCustomer?.lastname,
    customerPhone: cobranaCustomer?.phone ?? undefined,
    concept: fee.hecomClienteName
      ? `Recarga Holistic · ${fee.hecomClienteName}`
      : `Recarga Holistic`,
    metadata: {
      customer_full_name: cobranaCustomer?.fullName ?? undefined,
      customer_phone: cobranaCustomer?.phone ?? undefined,
    },
  });

  // Manual siempre voucher. Crypto: voucher solo si no hay checkout automático (NOWPayments).
  // Cobrana: requiere pago en Yape/banco (sin voucher Holistic).
  const voucherFlow =
    provider === "manual" ||
    (provider === "crypto" && !checkoutResult.checkoutUrl);

  const nextStatus = voucherFlow
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

  // Anotar modo cripto sin pisar metadata de fee.
  if (provider === "crypto") {
    await mergePaymentIntentMetadata(intent.id, {
      crypto_mode: voucherFlow ? "manual_proof" : "nowpayments",
      nowpayments_invoice_id: checkoutResult.providerReference,
    });
  }

  if (checkoutResult.resultMetadata) {
    await mergePaymentIntentMetadata(intent.id, checkoutResult.resultMetadata);
  }

  if (voucherFlow) {
    await sendManualPaymentEmailBestEffort({
      to: session.email,
      userId: session.id,
      organizationId,
      paymentIntentId: intent.id,
      amountCents,
      currency: intentCurrency,
    });
  }

  return {
    paymentIntentId: intent.id,
    status: nextStatus,
    provider,
    checkoutUrl: checkoutResult.checkoutUrl,
    providerConfigured: configured,
    message: checkoutResult.message,
    feePercent: fee.feePercent,
    feeCents: fee.feeCents,
    creditCents: fee.creditCents,
    grossCents: fee.grossCents,
    chargeCurrency:
      input.provider === "manual" || isCobrana ? chargeCurrency : undefined,
    grossChargeCents: amountCents,
    grossPenCents:
      (input.provider === "manual" && chargeCurrency === "PEN") || isCobrana
        ? amountCents
        : null,
    fxRateUsdPen:
      typeof manualQuoteMeta.fx_rate_usd_pen === "number"
        ? manualQuoteMeta.fx_rate_usd_pen
        : undefined,
    cobranaCode:
      typeof checkoutResult.resultMetadata?.cobrana_code === "string"
        ? checkoutResult.resultMetadata.cobrana_code
        : null,
    cobranaDeeplinks: Array.isArray(
      checkoutResult.resultMetadata?.cobrana_deeplinks,
    )
      ? (checkoutResult.resultMetadata.cobrana_deeplinks as Array<{
          key: string;
          label: string;
          url: string;
        }>)
      : undefined,
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
    // Eventos Stripe huérfanos (ej. payment_intent.succeeded con pi_… cuando
    // guardamos cs_… y aún no venía metadata). No reventar el webhook.
    console.warn("[payments] webhook sin payment intent local", {
      provider: input.provider,
      providerReference: input.providerReference ?? null,
      paymentIntentId: input.paymentIntentId ?? null,
      webhookEventId: input.webhookEventId ?? null,
    });
    return;
  }

  if (intent.provider !== input.provider) {
    throw new Error("El provider del webhook no coincide con la intención.");
  }

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

  // Ya succeeded (2º webhook Stripe): no re-acreditar; sí curar cobro Hecom si faltó.
  if (intent.status === "succeeded") {
    await ensureHecomWalletCobroSynced({
      intent,
      webhookEventId: input.webhookEventId,
      providerReference: input.providerReference ?? intent.providerReference,
    });
    return;
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

  const succeededAt = new Date().toISOString();
  // Claim atómico: evita doble depósito / doble email; el cobro Hecom es idempotente.
  const claimed = await claimPaymentIntentSucceeded(intent.id, {
    succeededAt,
    providerReference: input.providerReference ?? intent.providerReference,
    metadata: {
      ...intent.metadata,
      ledger_journal_id: ledgerJournalId,
      provider_reference: input.providerReference ?? intent.providerReference,
      hecom_cobro_sync_claim: input.webhookEventId ?? succeededAt,
    },
  });

  // Ganador o perdedor del claim: ambos intentan sync (Hecom AH-STRIPE-{id} es idempotente).
  // Antes el perdedor hacía return y si el ganador moría mid-bridge el cobro nunca aparecía en Lo pagado.
  await ensureHecomWalletCobroSynced({
    intent: {
      ...intent,
      metadata: {
        ...intent.metadata,
        ledger_journal_id: ledgerJournalId,
        provider_reference:
          input.providerReference ?? intent.providerReference,
      },
    },
    webhookEventId: input.webhookEventId,
    providerReference: input.providerReference ?? intent.providerReference,
    ledgerJournalId,
    succeededAt,
    claimed,
  });
}

function hecomCobroAlreadyOk(meta: Record<string, unknown> | null | undefined): boolean {
  const sync = meta?.hecom_cobro_sync;
  return Boolean(
    sync &&
      typeof sync === "object" &&
      (sync as { ok?: boolean }).ok === true,
  );
}

/** Bridge Hecom Lo pagado — reintentable; no lanza. */
async function ensureHecomWalletCobroSynced(input: {
  intent: {
    id: string;
    amountCents: number;
    currency: string;
    provider: string;
    metadata: Record<string, unknown> | null;
    providerReference?: string | null;
  };
  webhookEventId?: string;
  providerReference?: string | null;
  ledgerJournalId?: string;
  succeededAt?: string;
  claimed?: boolean;
}): Promise<void> {
  const fresh = await getPaymentIntentByIdInternal(input.intent.id);
  const meta = {
    ...(fresh?.metadata ?? input.intent.metadata ?? {}),
  } as Record<string, unknown>;

  if (hecomCobroAlreadyOk(meta)) return;

  const creditRaw = meta.credit_amount_cents;
  const feeRaw = meta.fee_amount_cents;
  const creditCents =
    typeof creditRaw === "number"
      ? creditRaw
      : typeof creditRaw === "string"
        ? Number(creditRaw)
        : null;
  const feeCents =
    typeof feeRaw === "number"
      ? feeRaw
      : typeof feeRaw === "string"
        ? Number(feeRaw)
        : null;
  const hecomClienteId =
    typeof meta.hecom_cliente_id === "string" ? meta.hecom_cliente_id : null;

  const paidAt = input.succeededAt ?? new Date().toISOString();

  const cobroSync = await syncWalletDepositCobroBestEffort({
    hecomClienteId,
    paymentIntentId: input.intent.id,
    amountCents: fresh?.amountCents ?? input.intent.amountCents,
    creditCents: Number.isFinite(creditCents as number)
      ? (creditCents as number)
      : null,
    feeCents: Number.isFinite(feeCents as number) ? (feeCents as number) : null,
    currency: fresh?.currency ?? input.intent.currency,
    paidAt,
    provider: fresh?.provider ?? input.intent.provider,
  });

  await mergePaymentIntentMetadata(input.intent.id, {
    ...(input.ledgerJournalId
      ? { ledger_journal_id: input.ledgerJournalId }
      : {}),
    ...(input.providerReference
      ? { provider_reference: input.providerReference }
      : {}),
    hecom_cobro_sync_claim:
      input.webhookEventId ??
      meta.hecom_cobro_sync_claim ??
      paidAt,
    hecom_cobro_sync: cobroSync
      ? {
          ok: cobroSync.ok,
          skipped: cobroSync.skipped ?? false,
          reason: cobroSync.reason ?? null,
          cobro_id: cobroSync.cobroId ?? null,
          codigo: cobroSync.codigo ?? null,
          periodo_resumen: cobroSync.periodoResumen ?? null,
          at: new Date().toISOString(),
          healed: input.claimed === false || input.claimed == null,
        }
      : null,
  });
}
