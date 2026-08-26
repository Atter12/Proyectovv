import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { depositFromDesiredCredit } from "@/lib/payments/deposit-fee";
import { resolveDepositFeeForSession } from "@/lib/payments/resolve-hecom-deposit-fee.server";
import {
  createPaymentIntentRecord,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { processSuccessfulPaymentIntent } from "@/lib/payments/create-intent.server";
import {
  chargeStripeOffSession,
  createStripeCustomer,
  createStripeSetupCheckoutSession,
  completeStripeSetupSession,
} from "@/lib/payments/stripe-billing.server";
import {
  getAutoRechargeRule,
  getBillingCustomer,
  listDueAutoRechargeRules,
  recordAutoRechargeAttempt,
  updateAutoRechargeRuleAfterAttempt,
  upsertAutoRechargeRule,
  upsertBillingCustomer,
  type AutoRechargeRuleRow,
} from "@/lib/payments/auto-recharge/auto-recharge.store.server";

const ALLOWED_INTERVALS = new Set([15, 20, 30]);

export function normalizeIntervalDays(days: number): number {
  const n = Math.round(days);
  if (ALLOWED_INTERVALS.has(n)) return n;
  if (n >= 7 && n <= 90) return n;
  throw new Error("Intervalo inválido. Usá 15, 20, 30 o entre 7 y 90 días.");
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

function addDaysIso(from: Date, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export async function getAutoRechargeState(organizationId: string) {
  const [billing, rule] = await Promise.all([
    getBillingCustomer(organizationId),
    getAutoRechargeRule(organizationId),
  ]);

  return {
    paymentMethod:
      billing?.default_payment_method_id && billing.status === "active"
        ? {
            brand: billing.card_brand,
            last4: billing.card_last4,
            expMonth: billing.card_exp_month,
            expYear: billing.card_exp_year,
          }
        : null,
    rule: rule
      ? {
          enabled: rule.enabled,
          calendarEnabled: rule.calendar_enabled,
          intervalDays: rule.calendar_interval_days,
          creditCents: rule.calendar_credit_cents,
          nextChargeAt: rule.calendar_next_charge_at,
          lastChargeAt: rule.last_charge_at,
          lastChargeStatus: rule.last_charge_status,
          consecutiveFailures: rule.consecutive_failures,
        }
      : null,
  };
}

export async function startBillingSetupSession(input: {
  organizationId: string;
  userId: string;
  email: string;
}): Promise<{ checkoutUrl: string }> {
  let billing = await getBillingCustomer(input.organizationId);
  let stripeCustomerId = billing?.stripe_customer_id;

  if (!stripeCustomerId) {
    stripeCustomerId = await createStripeCustomer({
      email: input.email,
      organizationId: input.organizationId,
    });
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
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
  });

  return { checkoutUrl: session.url };
}

export async function finalizeBillingSetup(input: {
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

export async function saveAutoRechargeSchedule(input: {
  organizationId: string;
  userId: string;
  hecomClienteId?: string | null;
  enabled: boolean;
  intervalDays: number;
  creditAmountUsd: number;
}): Promise<AutoRechargeRuleRow> {
  const billing = await getBillingCustomer(input.organizationId);
  if (
    input.enabled &&
    (!billing?.default_payment_method_id || billing.status !== "active")
  ) {
    throw new Error("Guardá una tarjeta antes de activar la recarga automática.");
  }

  const interval = normalizeIntervalDays(input.intervalDays);
  const creditCents = Math.round(input.creditAmountUsd * 100);
  if (creditCents < 1000) {
    throw new Error("El monto mínimo es $10 USD.");
  }
  if (creditCents > 500_000) {
    throw new Error("El monto máximo es $5,000 USD.");
  }

  const nextChargeAt = input.enabled
    ? addDaysIso(new Date(), interval)
    : null;

  return upsertAutoRechargeRule({
    organizationId: input.organizationId,
    hecomClienteId: input.hecomClienteId,
    enabled: input.enabled,
    calendarEnabled: input.enabled,
    intervalDays: interval,
    creditCents,
    nextChargeAt,
  });
}

export async function runCalendarAutoRechargeForRule(
  rule: AutoRechargeRuleRow,
): Promise<{ ok: boolean; error?: string }> {
  const billing = await getBillingCustomer(rule.organization_id);
  if (
    !billing?.default_payment_method_id ||
    !billing.stripe_customer_id ||
    billing.status !== "active"
  ) {
    await updateAutoRechargeRuleAfterAttempt({
      ruleId: rule.id,
      succeeded: false,
      intervalDays: rule.calendar_interval_days ?? 20,
      errorMessage: "Sin tarjeta guardada",
    });
    return { ok: false, error: "Sin tarjeta" };
  }

  const creditCents = Number(rule.calendar_credit_cents ?? 0);
  const intervalDays = rule.calendar_interval_days ?? 20;
  if (creditCents <= 0) {
    return { ok: false, error: "Monto inválido" };
  }

  const fee = await resolveDepositFeeForSession({
    userId: "system",
    creditCents,
    hecomClienteId: rule.hecom_cliente_id,
  });
  const split = depositFromDesiredCredit(creditCents, fee.feePercent);
  const walletId = await resolveWalletId(rule.organization_id);
  const idempotencyKey = `auto-recharge:${rule.id}:${new Date().toISOString().slice(0, 10)}`;

  const intent = await createPaymentIntentRecord({
    organizationId: rule.organization_id,
    walletId,
    amountCents: split.grossCents,
    currency: "USD",
    provider: "stripe",
    createdBy: null,
    idempotencyKey,
    metadata: {
      source: "auto_recharge_calendar",
      auto_recharge_rule_id: rule.id,
      fee_percent: fee.feePercent,
      fee_amount_cents: split.feeCents,
      credit_amount_cents: split.creditCents,
      gross_amount_cents: split.grossCents,
      hecom_cliente_id: rule.hecom_cliente_id,
    },
  });

  try {
    const charge = await chargeStripeOffSession({
      stripeCustomerId: billing.stripe_customer_id,
      paymentMethodId: billing.default_payment_method_id,
      amountCents: split.grossCents,
      currency: "USD",
      paymentIntentId: intent.id,
      organizationId: rule.organization_id,
      walletId,
      idempotencyKey: `stripe:${idempotencyKey}`,
    });

    await updatePaymentIntentRecord(intent.id, {
      status: charge.status === "succeeded" ? "succeeded" : "processing",
      providerReference: charge.stripePaymentIntentId,
    });

    if (charge.status === "succeeded") {
      await processSuccessfulPaymentIntent({
        provider: "stripe",
        providerReference: charge.stripePaymentIntentId,
        paymentIntentId: intent.id,
        amountCents: split.grossCents,
        currency: "USD",
      });
    }

    await recordAutoRechargeAttempt({
      ruleId: rule.id,
      organizationId: rule.organization_id,
      paymentIntentId: intent.id,
      triggerType: "calendar",
      creditCents: split.creditCents,
      grossCents: split.grossCents,
      feeCents: split.feeCents,
      status: charge.status,
      stripePaymentIntentId: charge.stripePaymentIntentId,
    });

    await updateAutoRechargeRuleAfterAttempt({
      ruleId: rule.id,
      succeeded: charge.status === "succeeded",
      intervalDays,
      errorMessage:
        charge.status === "succeeded"
          ? undefined
          : `Estado Stripe: ${charge.status}`,
    });

    return { ok: charge.status === "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    await updatePaymentIntentRecord(intent.id, {
      status: "failed",
      failureReason: message,
    });
    await recordAutoRechargeAttempt({
      ruleId: rule.id,
      organizationId: rule.organization_id,
      paymentIntentId: intent.id,
      triggerType: "calendar",
      creditCents: split.creditCents,
      grossCents: split.grossCents,
      feeCents: split.feeCents,
      status: "failed",
      errorMessage: message,
    });
    await updateAutoRechargeRuleAfterAttempt({
      ruleId: rule.id,
      succeeded: false,
      intervalDays,
      errorMessage: message,
    });
    return { ok: false, error: message };
  }
}

export async function runDueCalendarAutoRecharges(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const rules = await listDueAutoRechargeRules(30);
  let succeeded = 0;
  let failed = 0;

  for (const rule of rules) {
    const result = await runCalendarAutoRechargeForRule(rule);
    if (result.ok) succeeded += 1;
    else failed += 1;
  }

  return { processed: rules.length, succeeded, failed };
}
