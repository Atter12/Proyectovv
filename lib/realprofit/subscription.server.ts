import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const REALPROFIT_COD_AMOUNT_USD = 20;
export const REALPROFIT_COD_AMOUNT_CENTS = REALPROFIT_COD_AMOUNT_USD * 100;
export const REALPROFIT_COD_PURPOSE = "realprofit_cod";
export const REALPROFIT_COD_DAYS = 30;

export type RealProfitSubStatus =
  | "pending_payment"
  | "active"
  | "expired"
  | "rejected"
  | "none";

export type RealProfitSubscription = {
  hecomClienteId: string;
  status: RealProfitSubStatus;
  activeFrom: string | null;
  activeUntil: string | null;
  lastPaymentIntentId: string | null;
  isActive: boolean;
};

function mapRow(row: {
  hecom_cliente_id: string;
  status: string;
  active_from: string | null;
  active_until: string | null;
  last_payment_intent_id: string | null;
}): RealProfitSubscription {
  const until = row.active_until ? new Date(row.active_until) : null;
  const status = row.status as RealProfitSubStatus;
  const isActive =
    status === "active" && (!until || until.getTime() > Date.now());
  return {
    hecomClienteId: row.hecom_cliente_id,
    status: isActive ? "active" : status === "active" ? "expired" : status,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
    lastPaymentIntentId: row.last_payment_intent_id,
    isActive,
  };
}

/** Evita FK rota si session.organizationId no existe en organizations. */
async function sanitizeOrganizationId(
  organizationId: string | null | undefined,
): Promise<string | null> {
  const raw = String(organizationId ?? "").trim();
  if (!raw) return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      raw,
    )
  ) {
    return null;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("id", raw)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function getRealProfitSubscription(
  hecomClienteId: string,
): Promise<RealProfitSubscription> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hecom_cliente_realprofit_subs")
    .select(
      "hecom_cliente_id, status, active_from, active_until, last_payment_intent_id",
    )
    .eq("hecom_cliente_id", hecomClienteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      hecomClienteId,
      status: "none",
      activeFrom: null,
      activeUntil: null,
      lastPaymentIntentId: null,
      isActive: false,
    };
  }
  return mapRow(data);
}

export async function markRealProfitSubPending(input: {
  hecomClienteId: string;
  organizationId: string;
  paymentIntentId: string;
  userId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const organizationId = await sanitizeOrganizationId(input.organizationId);
  const now = new Date().toISOString();
  const { error } = await admin.from("hecom_cliente_realprofit_subs").upsert(
    {
      hecom_cliente_id: input.hecomClienteId,
      organization_id: organizationId,
      status: "pending_payment",
      last_payment_intent_id: input.paymentIntentId,
      created_by: input.userId,
      updated_at: now,
    },
    { onConflict: "hecom_cliente_id" },
  );
  if (error) throw new Error(error.message);
}

export async function activateRealProfitSubscription(input: {
  hecomClienteId: string;
  organizationId: string;
  paymentIntentId: string;
  userId?: string | null;
}): Promise<RealProfitSubscription> {
  const admin = createAdminClient();
  const organizationId = await sanitizeOrganizationId(input.organizationId);
  const existing = await getRealProfitSubscription(input.hecomClienteId);
  const base =
    existing.isActive && existing.activeUntil
      ? new Date(existing.activeUntil)
      : new Date();
  if (base.getTime() < Date.now()) base.setTime(Date.now());
  const until = new Date(base.getTime());
  until.setUTCDate(until.getUTCDate() + REALPROFIT_COD_DAYS);
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("hecom_cliente_realprofit_subs")
    .upsert(
      {
        hecom_cliente_id: input.hecomClienteId,
        organization_id: organizationId,
        status: "active",
        active_from: now,
        active_until: until.toISOString(),
        last_payment_intent_id: input.paymentIntentId,
        created_by: input.userId ?? null,
        updated_at: now,
      },
      { onConflict: "hecom_cliente_id" },
    )
    .select(
      "hecom_cliente_id, status, active_from, active_until, last_payment_intent_id",
    )
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function rejectRealProfitSubscriptionPayment(input: {
  hecomClienteId: string;
  paymentIntentId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("hecom_cliente_realprofit_subs")
    .update({
      status: "rejected",
      last_payment_intent_id: input.paymentIntentId,
      updated_at: new Date().toISOString(),
    })
    .eq("hecom_cliente_id", input.hecomClienteId)
    .eq("status", "pending_payment");
  if (error) throw new Error(error.message);
}

export function isRealProfitCodPurpose(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return false;
  return String(metadata.purpose ?? "").trim() === REALPROFIT_COD_PURPOSE;
}
