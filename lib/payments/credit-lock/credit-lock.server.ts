import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";
import { resolveHecomBillingModality } from "@/lib/hecom/clientes.server";
import { syncWalletDepositCobroBestEffort } from "@/lib/hecom/wallet-cobro-bridge.server";
import {
  createPaymentIntentRecord,
  updatePaymentIntentRecord,
  claimPaymentIntentSucceeded,
  mergePaymentIntentMetadata,
} from "@/lib/payments/payment-intents.server";
import {
  chargeStripeOffSession,
  completeStripeSetupSession,
  createStripeCustomer,
  createStripeSetupCheckoutSession,
  detachStripePaymentMethod,
} from "@/lib/payments/stripe-billing.server";
import {
  getBillingCustomer,
  markBillingCustomerDetached,
  upsertBillingCustomer,
} from "@/lib/payments/auto-recharge/auto-recharge.store.server";
import {
  getCreditLockProfile,
  setCreditLockApproval,
  upsertCreditLockProfile,
  type CreditLockApprovalStatus,
} from "@/lib/payments/credit-lock/credit-lock.store.server";

/** Candado anti-vivo: tarjeta on file + cobro al quitar con deuda. Independiente del calendario. */
export const CREDIT_STRIPE_LOCK_ENABLED = true;

/** Mínimo Stripe USD (cents). Debajo: detach libre (deuda immaterial). */
const STRIPE_MIN_CHARGE_CENTS = 50;

/** Cupo mínimo / máximo que se puede pedir (USD). */
export const CREDIT_REQUEST_MIN_USD = 50;
export const CREDIT_REQUEST_MAX_USD = 50_000;

/** Default: tarjeta “un poco más” que el cupo (+15%). */
export const CREDIT_CARD_HEADROOM_PERCENT = 15;

/** Default: pausar fondeo al 90% del cupo. */
export const CREDIT_SOFT_CAP_PERCENT = 90;

export function recommendedCardCents(
  requestedCreditCents: number,
  headroomPercent = CREDIT_CARD_HEADROOM_PERCENT,
): number {
  return Math.ceil(requestedCreditCents * (1 + headroomPercent / 100));
}

async function resolveWalletId(organizationId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Cartera no encontrada.");
  return data.id;
}

export type CreditLockDebt = {
  saldoEstimado: number;
  debtUsd: number;
  debtCents: number;
  chargeable: boolean;
};

/**
 * Deuda viva Hecom ≈ −saldoEstimado (cobros − gastos − fees).
 * Positivo = debe; 0 = al día / a favor.
 */
export async function getCreditLockDebt(
  hecomClienteId: string,
): Promise<CreditLockDebt> {
  const data = await getHecomClienteDashboard(hecomClienteId, {
    includeCampaignSpend: false,
    includeCreativos: false,
    includeDailySpend: false,
  });
  if (!data) {
    throw new Error("No se pudo cargar el saldo Hecom del cliente.");
  }
  const saldoEstimado = Number(data.summary.saldoEstimado ?? 0);
  const debtUsd = saldoEstimado < 0 ? Math.abs(saldoEstimado) : 0;
  const debtCents = Math.round(debtUsd * 100);
  return {
    saldoEstimado,
    debtUsd,
    debtCents,
    chargeable: debtCents >= STRIPE_MIN_CHARGE_CENTS,
  };
}

export async function getCreditLockState(input: {
  organizationId: string;
  hecomClienteId: string | null;
}) {
  const [billing, profile] = await Promise.all([
    getBillingCustomer(input.organizationId),
    getCreditLockProfile(input.organizationId),
  ]);
  const paymentMethod =
    billing?.default_payment_method_id && billing.status === "active"
      ? {
          brand: billing.card_brand,
          last4: billing.card_last4,
          expMonth: billing.card_exp_month,
          expYear: billing.card_exp_year,
        }
      : null;

  let billingModality: "credito" | "prepago" | "unknown" = "unknown";
  if (input.hecomClienteId) {
    const data = await getHecomClienteDashboard(input.hecomClienteId, {
      includeCampaignSpend: false,
      includeCreativos: false,
      includeDailySpend: false,
    });
    if (data) {
      billingModality = resolveHecomBillingModality(data.cliente);
    }
  }

  const requestedCreditCents = profile?.requested_credit_cents ?? null;
  const approvalStatus: CreditLockApprovalStatus =
    profile?.approval_status ??
    (requestedCreditCents != null ? "requested" : "none");
  const headroom =
    profile?.card_headroom_percent != null
      ? Number(profile.card_headroom_percent)
      : CREDIT_CARD_HEADROOM_PERCENT;
  const softCap =
    profile?.soft_cap_percent != null
      ? Number(profile.soft_cap_percent)
      : CREDIT_SOFT_CAP_PERCENT;
  const approved = approvalStatus === "approved";
  const hasCard = Boolean(paymentMethod?.last4);

  return {
    enabled: CREDIT_STRIPE_LOCK_ENABLED,
    billingModality,
    paymentMethod,
    /** No exponer deuda / cobro al detach al cliente (interno). */
    cupo: {
      approvalStatus,
      requestedCreditCents,
      requestedCreditUsd:
        requestedCreditCents != null ? requestedCreditCents / 100 : null,
      cardHeadroomPercent: headroom,
      recommendedCardCents:
        requestedCreditCents != null
          ? recommendedCardCents(requestedCreditCents, headroom)
          : null,
      recommendedCardUsd:
        requestedCreditCents != null
          ? recommendedCardCents(requestedCreditCents, headroom) / 100
          : null,
      softCapPercent: softCap,
      requireCard: profile?.require_card ?? true,
      hasCard,
      /** Listo solo si gerencia aprobó + tarjeta. */
      lockReady: approved && hasCard && requestedCreditCents != null,
      canLinkCard: approved,
      requestedAt: profile?.requested_at ?? null,
      reviewedAt: profile?.reviewed_at ?? null,
    },
  };
}

export async function saveCreditLockCupo(input: {
  organizationId: string;
  hecomClienteId: string | null;
  requestedCreditUsd: number;
}): Promise<Awaited<ReturnType<typeof getCreditLockState>>["cupo"]> {
  if (!CREDIT_STRIPE_LOCK_ENABLED) {
    throw new Error("El candado Stripe de crédito está desactivado.");
  }
  const usd = Number(input.requestedCreditUsd);
  if (!Number.isFinite(usd)) {
    throw new Error("Monto de crédito inválido.");
  }
  if (usd < CREDIT_REQUEST_MIN_USD) {
    throw new Error(`El crédito mínimo es $${CREDIT_REQUEST_MIN_USD} USD.`);
  }
  if (usd > CREDIT_REQUEST_MAX_USD) {
    throw new Error(`El crédito máximo es $${CREDIT_REQUEST_MAX_USD} USD.`);
  }
  const cents = Math.round(usd * 100);
  const existing = await getCreditLockProfile(input.organizationId);
  // Si ya estaba aprobado y solo cambia monto → vuelve a “requested” (re-aprobación).
  const nextStatus: CreditLockApprovalStatus =
    existing?.approval_status === "approved" &&
    existing.requested_credit_cents === cents
      ? "approved"
      : "requested";

  await upsertCreditLockProfile({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId,
    requestedCreditCents: cents,
    cardHeadroomPercent: CREDIT_CARD_HEADROOM_PERCENT,
    softCapPercent: CREDIT_SOFT_CAP_PERCENT,
    requireCard: true,
    approvalStatus: nextStatus,
    requestedAt: new Date().toISOString(),
    reviewedAt: nextStatus === "approved" ? existing?.reviewed_at ?? null : null,
    reviewedBy: nextStatus === "approved" ? existing?.reviewed_by ?? null : null,
  });

  const state = await getCreditLockState({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId,
  });
  return state.cupo;
}

export async function reviewCreditLockRequest(input: {
  organizationId: string;
  hecomClienteId: string | null;
  decision: "approved" | "rejected";
  reviewedBy: string;
  notes?: string | null;
}): Promise<Awaited<ReturnType<typeof getCreditLockState>>["cupo"]> {
  const profile = await getCreditLockProfile(input.organizationId);
  if (!profile?.requested_credit_cents) {
    throw new Error("No hay un pedido de crédito para revisar.");
  }
  await setCreditLockApproval({
    organizationId: input.organizationId,
    status: input.decision,
    reviewedBy: input.reviewedBy,
    notes: input.notes,
  });
  const state = await getCreditLockState({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId,
  });
  return state.cupo;
}

/**
 * Tope suave + tarjeta Stripe para fondeo a crédito (cash BM / cupo).
 * NO bloquea asignación desde cartera Holistic ya pagada (Stripe/Yape/BCP).
 */
export async function assertCreditLockAllowsAllocate(input: {
  organizationId: string;
  hecomClienteId: string | null | undefined;
  amountCents: number;
  /** Solo se aplica el candado cuando el fondeo es a crédito BM, no cartera prepago. */
  agencyBmFunding?: boolean;
}): Promise<void> {
  if (!CREDIT_STRIPE_LOCK_ENABLED) return;
  // Recarga ya pagada en cartera → el cliente puede asignar a TikTok sin candado.
  if (!input.agencyBmFunding) return;

  const hecomId = input.hecomClienteId?.trim();
  if (!hecomId) return;

  const data = await getHecomClienteDashboard(hecomId, {
    includeCampaignSpend: false,
    includeCreativos: false,
    includeDailySpend: false,
  });
  if (!data) return;
  if (resolveHecomBillingModality(data.cliente) !== "credito") return;

  const [profile, billing] = await Promise.all([
    getCreditLockProfile(input.organizationId),
    getBillingCustomer(input.organizationId),
  ]);

  const approval = profile?.approval_status ?? "none";
  if (approval !== "approved") {
    throw new Error(
      approval === "requested"
        ? "Tu pedido de crédito Holistic está en revisión. Gerencia debe aceptarlo antes de fondear."
        : "Pedí crédito Holistic en Pagos y esperá la aceptación de gerencia antes de fondear desde BM.",
    );
  }

  const requireCard = profile?.require_card ?? true;
  const hasCard =
    Boolean(billing?.default_payment_method_id) && billing?.status === "active";

  if (requireCard && !hasCard) {
    throw new Error(
      "Crédito solo con candado Stripe: guarda una tarjeta en Pagos antes de fondear desde BM.",
    );
  }

  const requested = profile?.requested_credit_cents;
  if (requested == null || requested <= 0) {
    throw new Error(
      "Indica el monto de crédito solicitado (USD) en Pagos antes de fondear desde BM.",
    );
  }

  const softCapPercent = Number(
    profile?.soft_cap_percent ?? CREDIT_SOFT_CAP_PERCENT,
  );
  const softCapCents = Math.floor((requested * softCapPercent) / 100);

  const saldoEstimado = Number(data.summary.saldoEstimado ?? 0);
  const exposureCents =
    saldoEstimado < 0 ? Math.round(Math.abs(saldoEstimado) * 100) : 0;
  const nextExposure = exposureCents + Math.max(0, input.amountCents);

  if (nextExposure > softCapCents) {
    throw new Error(
      `Tope suave del cupo crédito ($${softCapCents / 100} = ${softCapPercent}% de $${requested / 100}). ` +
        `Exposición actual ~$${exposureCents / 100}. Paga el ciclo o pide ampliar cupo.`,
    );
  }
}

export async function startCreditLockSetupSession(input: {
  organizationId: string;
  email: string;
}): Promise<{ checkoutUrl: string }> {
  if (!CREDIT_STRIPE_LOCK_ENABLED) {
    throw new Error("El candado Stripe de crédito está desactivado.");
  }

  let billing = await getBillingCustomer(input.organizationId);
  let stripeCustomerId = billing?.stripe_customer_id;

  if (!stripeCustomerId) {
    stripeCustomerId = await createStripeCustomer({
      email: input.email,
      organizationId: input.organizationId,
    });
    const admin = createAdminClient();
    await admin.from("billing_customers").upsert(
      {
        organization_id: input.organizationId,
        stripe_customer_id: stripeCustomerId,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    );
  }

  const session = await createStripeSetupCheckoutSession({
    stripeCustomerId,
    organizationId: input.organizationId,
    customerEmail: input.email,
    purpose: "credito_lock",
  });

  return { checkoutUrl: session.url };
}

export async function finalizeCreditLockSetup(input: {
  sessionId: string;
  organizationId: string;
}): Promise<void> {
  const result = await completeStripeSetupSession(input.sessionId);
  if (result.organizationId !== input.organizationId) {
    throw new Error("La sesión no corresponde a tu organización.");
  }

  await upsertBillingCustomer({
    organizationId: input.organizationId,
    stripeCustomerId: result.stripeCustomerId,
    paymentMethodId: result.paymentMethod.id,
    cardBrand: result.paymentMethod.brand,
    cardLast4: result.paymentMethod.last4,
    cardExpMonth: result.paymentMethod.expMonth,
    cardExpYear: result.paymentMethod.expYear,
  });
}

/**
 * Quita la tarjeta. Si hay deuda Hecom ≥ $0.50, cobra off-session primero.
 * Éxito → cobro Hecom (sin acreditar cartera) + detach.
 * Fallo de cobro → no detach.
 */
export async function detachCreditLockPaymentMethod(input: {
  organizationId: string;
  hecomClienteId: string;
  userId: string;
}): Promise<{
  detached: boolean;
  chargedCents: number;
  paymentIntentId?: string;
}> {
  if (!CREDIT_STRIPE_LOCK_ENABLED) {
    throw new Error("El candado Stripe de crédito está desactivado.");
  }

  const billing = await getBillingCustomer(input.organizationId);
  if (
    !billing?.default_payment_method_id ||
    !billing.stripe_customer_id ||
    billing.status !== "active"
  ) {
    throw new Error("No hay tarjeta guardada para quitar.");
  }

  const debt = await getCreditLockDebt(input.hecomClienteId);
  let chargedCents = 0;
  let paymentIntentId: string | undefined;

  if (debt.chargeable) {
    const walletId = await resolveWalletId(input.organizationId);
    const idempotencyKey = `credito-detach:${input.organizationId}:${debt.debtCents}:${new Date().toISOString().slice(0, 13)}`;

    const intent = await createPaymentIntentRecord({
      organizationId: input.organizationId,
      walletId,
      amountCents: debt.debtCents,
      currency: "USD",
      provider: "stripe",
      createdBy: input.userId,
      idempotencyKey,
      metadata: {
        source: "credito_detach",
        skip_wallet_credit: true,
        purpose: "credito_lock_debt",
        hecom_cliente_id: input.hecomClienteId,
        credit_amount_cents: debt.debtCents,
        fee_amount_cents: 0,
        gross_amount_cents: debt.debtCents,
        debt_saldo_estimado: debt.saldoEstimado,
      },
    });
    paymentIntentId = intent.id;

    try {
      const charge = await chargeStripeOffSession({
        stripeCustomerId: billing.stripe_customer_id,
        paymentMethodId: billing.default_payment_method_id,
        amountCents: debt.debtCents,
        currency: "USD",
        paymentIntentId: intent.id,
        organizationId: input.organizationId,
        walletId,
        idempotencyKey: `stripe:${idempotencyKey}`,
        source: "credito_detach",
      });

      if (charge.status !== "succeeded") {
        await updatePaymentIntentRecord(intent.id, {
          status: "failed",
          providerReference: charge.stripePaymentIntentId,
          failureReason: `Estado Stripe: ${charge.status}`,
        });
        throw new Error("CREDIT_LOCK_DETACH_CHARGE_FAILED");
      }

      chargedCents = debt.debtCents;
      const succeededAt = new Date().toISOString();
      await claimPaymentIntentSucceeded(intent.id, {
        succeededAt,
        providerReference: charge.stripePaymentIntentId,
        metadata: {
          ...intent.metadata,
          skip_wallet_credit: true,
          source: "credito_detach",
          provider_reference: charge.stripePaymentIntentId,
        },
      });

      const cobroSync = await syncWalletDepositCobroBestEffort({
        hecomClienteId: input.hecomClienteId,
        paymentIntentId: intent.id,
        amountCents: debt.debtCents,
        creditCents: debt.debtCents,
        feeCents: 0,
        currency: "USD",
        paidAt: succeededAt,
        provider: "stripe",
      });

      await mergePaymentIntentMetadata(intent.id, {
        hecom_cobro_sync: cobroSync
          ? {
              ok: cobroSync.ok,
              skipped: cobroSync.skipped ?? false,
              reason: cobroSync.reason ?? null,
              cobro_id: cobroSync.cobroId ?? null,
              codigo: cobroSync.codigo ?? null,
              at: new Date().toISOString(),
            }
          : null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error cobrando deuda";
      if (message !== "CREDIT_LOCK_DETACH_CHARGE_FAILED") {
        await updatePaymentIntentRecord(intent.id, {
          status: "failed",
          failureReason: message,
        });
      }
      throw new Error("CREDIT_LOCK_DETACH_CHARGE_FAILED");
    }
  } else if (debt.debtCents > 0) {
    console.info("[credit-lock] detach_skip_tiny_debt", {
      organizationId: input.organizationId,
      debtCents: debt.debtCents,
    });
  }

  await detachStripePaymentMethod(billing.default_payment_method_id);
  await markBillingCustomerDetached(input.organizationId);

  return {
    detached: true,
    chargedCents,
    paymentIntentId,
  };
}
