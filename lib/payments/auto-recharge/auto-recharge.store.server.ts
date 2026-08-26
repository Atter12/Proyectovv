import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingCustomerRow = {
  organization_id: string;
  stripe_customer_id: string;
  default_payment_method_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  status: string;
};

export type AutoRechargeRuleRow = {
  id: string;
  organization_id: string;
  hecom_cliente_id: string | null;
  enabled: boolean;
  calendar_enabled: boolean;
  calendar_interval_days: number | null;
  calendar_credit_cents: number | null;
  calendar_next_charge_at: string | null;
  calendar_timezone: string;
  consecutive_failures: number;
  max_failures_before_pause: number;
  last_charge_at: string | null;
  last_charge_status: string | null;
  metadata: Record<string, unknown>;
};

export async function getBillingCustomer(
  organizationId: string,
): Promise<BillingCustomerRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_customers")
    .select(
      "organization_id,stripe_customer_id,default_payment_method_id,card_brand,card_last4,card_exp_month,card_exp_year,status",
    )
    .eq("organization_id", organizationId)
    .maybeSingle<BillingCustomerRow>();

  if (error) {
    if (error.code === "42P01") return null;
    throw new Error(error.message);
  }
  return data;
}

export async function upsertBillingCustomer(input: {
  organizationId: string;
  stripeCustomerId: string;
  paymentMethodId: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("billing_customers").upsert(
    {
      organization_id: input.organizationId,
      stripe_customer_id: input.stripeCustomerId,
      default_payment_method_id: input.paymentMethodId,
      card_brand: input.cardBrand,
      card_last4: input.cardLast4,
      card_exp_month: input.cardExpMonth,
      card_exp_year: input.cardExpYear,
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) throw new Error(error.message);
}

export async function getAutoRechargeRule(
  organizationId: string,
): Promise<AutoRechargeRuleRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auto_recharge_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle<AutoRechargeRuleRow>();

  if (error) {
    if (error.code === "42P01") return null;
    throw new Error(error.message);
  }
  return data;
}

export async function upsertAutoRechargeRule(input: {
  organizationId: string;
  hecomClienteId?: string | null;
  enabled: boolean;
  calendarEnabled: boolean;
  intervalDays: number;
  creditCents: number;
  nextChargeAt: string | null;
}): Promise<AutoRechargeRuleRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("auto_recharge_rules")
    .upsert(
      {
        organization_id: input.organizationId,
        hecom_cliente_id: input.hecomClienteId ?? null,
        enabled: input.enabled,
        calendar_enabled: input.calendarEnabled,
        calendar_interval_days: input.intervalDays,
        calendar_credit_cents: input.creditCents,
        calendar_next_charge_at: input.nextChargeAt,
        consecutive_failures: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id" },
    )
    .select("*")
    .single<AutoRechargeRuleRow>();

  if (error) throw new Error(error.message);
  return data;
}

export async function listDueAutoRechargeRules(
  limit = 50,
): Promise<AutoRechargeRuleRow[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("auto_recharge_rules")
    .select("*")
    .eq("enabled", true)
    .eq("calendar_enabled", true)
    .lte("calendar_next_charge_at", now)
    .order("calendar_next_charge_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return (data ?? []) as AutoRechargeRuleRow[];
}

export async function updateAutoRechargeRuleAfterAttempt(input: {
  ruleId: string;
  succeeded: boolean;
  intervalDays: number;
  errorMessage?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date();
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + input.intervalDays);

  const { data: current } = await admin
    .from("auto_recharge_rules")
    .select("consecutive_failures,max_failures_before_pause")
    .eq("id", input.ruleId)
    .maybeSingle<{
      consecutive_failures: number;
      max_failures_before_pause: number;
    }>();

  const failures = input.succeeded
    ? 0
    : (current?.consecutive_failures ?? 0) + 1;
  const maxFailures = current?.max_failures_before_pause ?? 3;
  const pause = !input.succeeded && failures >= maxFailures;

  const { error } = await admin
    .from("auto_recharge_rules")
    .update({
      last_charge_at: now.toISOString(),
      last_charge_status: input.succeeded ? "succeeded" : "failed",
      calendar_next_charge_at: next.toISOString(),
      consecutive_failures: failures,
      enabled: pause ? false : true,
      updated_at: now.toISOString(),
      ...(input.errorMessage && !input.succeeded
        ? {
            metadata: {
              last_error: input.errorMessage,
              last_error_at: now.toISOString(),
            },
          }
        : {}),
    })
    .eq("id", input.ruleId);

  if (error) throw new Error(error.message);
}

export async function recordAutoRechargeAttempt(input: {
  ruleId: string;
  organizationId: string;
  paymentIntentId?: string | null;
  triggerType: "calendar" | "threshold" | "manual";
  creditCents: number;
  grossCents: number;
  feeCents: number;
  status: string;
  stripePaymentIntentId?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("auto_recharge_attempts").insert({
    rule_id: input.ruleId,
    organization_id: input.organizationId,
    payment_intent_id: input.paymentIntentId ?? null,
    trigger_type: input.triggerType,
    credit_cents: input.creditCents,
    gross_cents: input.grossCents,
    fee_cents: input.feeCents,
    status: input.status,
    stripe_payment_intent_id: input.stripePaymentIntentId ?? null,
    error_message: input.errorMessage ?? null,
  });
  if (error) throw new Error(error.message);
}
