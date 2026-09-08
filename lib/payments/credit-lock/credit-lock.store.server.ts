import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CreditLockProfileRow = {
  organization_id: string;
  hecom_cliente_id: string | null;
  requested_credit_cents: number | null;
  card_headroom_percent: number;
  soft_cap_percent: number;
  require_card: boolean;
  notes: string | null;
};

const PROFILE_SELECT =
  "organization_id,hecom_cliente_id,requested_credit_cents,card_headroom_percent,soft_cap_percent,require_card,notes";

export async function getCreditLockProfile(
  organizationId: string,
): Promise<CreditLockProfileRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("credit_lock_profiles")
    .select(PROFILE_SELECT)
    .eq("organization_id", organizationId)
    .maybeSingle<CreditLockProfileRow>();

  if (error) {
    if (error.code === "42P01") return null;
    throw new Error(error.message);
  }
  return data;
}

export async function upsertCreditLockProfile(input: {
  organizationId: string;
  hecomClienteId?: string | null;
  requestedCreditCents: number;
  cardHeadroomPercent?: number;
  softCapPercent?: number;
  requireCard?: boolean;
  notes?: string | null;
}): Promise<CreditLockProfileRow> {
  const admin = createAdminClient();
  const payload = {
    organization_id: input.organizationId,
    hecom_cliente_id: input.hecomClienteId ?? null,
    requested_credit_cents: input.requestedCreditCents,
    card_headroom_percent: input.cardHeadroomPercent ?? 15,
    soft_cap_percent: input.softCapPercent ?? 90,
    require_card: input.requireCard ?? true,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from("credit_lock_profiles")
    .upsert(payload, { onConflict: "organization_id" })
    .select(PROFILE_SELECT)
    .single<CreditLockProfileRow>();

  if (error) throw new Error(error.message);
  return data;
}
