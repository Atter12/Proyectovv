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

/** Candado anti-vivo: tarjeta on file + cobro al quitar con deuda. Independiente del calendario. */
export const CREDIT_STRIPE_LOCK_ENABLED = true;

/** Mínimo Stripe USD (cents). Debajo: detach libre (deuda immaterial). */
const STRIPE_MIN_CHARGE_CENTS = 50;

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
  const billing = await getBillingCustomer(input.organizationId);
  const paymentMethod =
    billing?.default_payment_method_id && billing.status === "active"
      ? {
          brand: billing.card_brand,
          last4: billing.card_last4,
          expMonth: billing.card_exp_month,
          expYear: billing.card_exp_year,
        }
      : null;

  let debt: CreditLockDebt | null = null;
  let billingModality: "credito" | "prepago" | "unknown" = "unknown";
  if (input.hecomClienteId) {
    const data = await getHecomClienteDashboard(input.hecomClienteId, {
      includeCampaignSpend: false,
      includeCreativos: false,
      includeDailySpend: false,
    });
    if (data) {
      billingModality = resolveHecomBillingModality(data.cliente);
      const saldoEstimado = Number(data.summary.saldoEstimado ?? 0);
      const debtUsd = saldoEstimado < 0 ? Math.abs(saldoEstimado) : 0;
      const debtCents = Math.round(debtUsd * 100);
      debt = {
        saldoEstimado,
        debtUsd,
        debtCents,
        chargeable: debtCents >= STRIPE_MIN_CHARGE_CENTS,
      };
    }
  }

  return {
    enabled: CREDIT_STRIPE_LOCK_ENABLED,
    billingModality,
    paymentMethod,
    debt,
  };
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
        throw new Error(
          `No se pudo cobrar la deuda ($${ (debt.debtCents / 100).toFixed(2) }). La tarjeta sigue vinculada. Pagá por Cobrana/BCP o reintentá.`,
        );
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
      if (!message.includes("tarjeta sigue vinculada")) {
        await updatePaymentIntentRecord(intent.id, {
          status: "failed",
          failureReason: message,
        });
      }
      throw error instanceof Error
        ? error
        : new Error(message);
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
