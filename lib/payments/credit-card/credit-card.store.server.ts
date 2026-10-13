import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreditCardMethodRow = {
  organization_id: string;
  hecom_cliente_id: string | null;
  provider: "whop";
  whop_member_id: string | null;
  whop_payment_method_id: string | null;
  whop_setup_intent_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  status: "active" | "detached";
  consent_at: string | null;
  consent_by: string | null;
  consent_text: string | null;
};

const SELECT =
  "organization_id,hecom_cliente_id,provider,whop_member_id,whop_payment_method_id,whop_setup_intent_id,card_brand,card_last4,card_exp_month,card_exp_year,status,consent_at,consent_by,consent_text";

/** Tabla nueva (migración 065): si aún no está aplicada se comporta como «sin tarjeta». */
function missingTable(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /credit_card_methods/i.test(error.message ?? "");
}

export async function getCreditCardMethod(
  organizationId: string,
): Promise<CreditCardMethodRow | null> {
  const { data, error } = await createAdminClient()
    .from("credit_card_methods")
    .select(SELECT)
    .eq("organization_id", organizationId)
    .maybeSingle<CreditCardMethodRow>();
  if (error) {
    if (missingTable(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

/** Tarjeta lista para cobrar. */
export function isChargeableCard(row: CreditCardMethodRow | null): row is CreditCardMethodRow & {
  whop_member_id: string;
  whop_payment_method_id: string;
} {
  return Boolean(row && row.status === "active" && row.whop_member_id && row.whop_payment_method_id);
}

export async function upsertCreditCardMethod(input: {
  organizationId: string;
  hecomClienteId: string | null;
  memberId: string;
  paymentMethodId: string;
  setupIntentId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  consentAt: string | null;
  consentBy: string | null;
  consentText: string | null;
}): Promise<void> {
  const { error } = await createAdminClient().from("credit_card_methods").upsert(
    {
      organization_id: input.organizationId,
      hecom_cliente_id: input.hecomClienteId,
      provider: "whop",
      whop_member_id: input.memberId,
      whop_payment_method_id: input.paymentMethodId,
      whop_setup_intent_id: input.setupIntentId,
      card_brand: input.brand,
      card_last4: input.last4,
      card_exp_month: input.expMonth,
      card_exp_year: input.expYear,
      status: "active",
      consent_at: input.consentAt,
      consent_by: input.consentBy,
      consent_text: input.consentText,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) throw new Error(error.message);
}

export async function markCreditCardDetached(organizationId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("credit_card_methods")
    .update({ status: "detached", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

export type AutochargeProfileRow = {
  organization_id: string;
  hecom_cliente_id: string | null;
  requested_credit_cents: number | null;
  soft_cap_percent: number;
  autocharge_failed_since: string | null;
  autocharge_last_error: string | null;
  autocharge_last_charge_at: string | null;
  autocharge_frozen_at: string | null;
};

/** Clientes con crédito aprobado (los que pueden tener cobro automático). */
export async function listApprovedCreditProfiles(): Promise<AutochargeProfileRow[]> {
  const { data, error } = await createAdminClient()
    .from("credit_lock_profiles")
    .select(
      "organization_id,hecom_cliente_id,requested_credit_cents,soft_cap_percent,autocharge_failed_since,autocharge_last_error,autocharge_last_charge_at,autocharge_frozen_at",
    )
    .eq("approval_status", "approved");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    organization_id: String(row.organization_id),
    hecom_cliente_id: row.hecom_cliente_id ? String(row.hecom_cliente_id) : null,
    requested_credit_cents: row.requested_credit_cents != null ? Number(row.requested_credit_cents) : null,
    soft_cap_percent: Number(row.soft_cap_percent ?? 90),
    autocharge_failed_since: (row.autocharge_failed_since as string | null) ?? null,
    autocharge_last_error: (row.autocharge_last_error as string | null) ?? null,
    autocharge_last_charge_at: (row.autocharge_last_charge_at as string | null) ?? null,
    autocharge_frozen_at: (row.autocharge_frozen_at as string | null) ?? null,
  }));
}

export async function getAutochargeStatus(organizationId: string): Promise<{
  failedSince: string | null;
  lastError: string | null;
  frozenAt: string | null;
}> {
  const { data, error } = await createAdminClient()
    .from("credit_lock_profiles")
    .select("autocharge_failed_since,autocharge_last_error,autocharge_frozen_at")
    .eq("organization_id", organizationId)
    .maybeSingle<{
      autocharge_failed_since: string | null;
      autocharge_last_error: string | null;
      autocharge_frozen_at: string | null;
    }>();
  // Sin migración 065 todavía: sin rechazos registrados.
  if (error || !data) return { failedSince: null, lastError: null, frozenAt: null };
  return {
    failedSince: data.autocharge_failed_since,
    lastError: data.autocharge_last_error,
    frozenAt: data.autocharge_frozen_at,
  };
}

export async function updateAutochargeStatus(
  organizationId: string,
  patch: Partial<{
    autocharge_failed_since: string | null;
    autocharge_last_error: string | null;
    autocharge_last_charge_at: string | null;
    autocharge_frozen_at: string | null;
  }>,
): Promise<void> {
  const { error } = await createAdminClient()
    .from("credit_lock_profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}
