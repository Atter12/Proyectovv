import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DbPaymentProvider, DbPaymentStatus } from "@/types/database";

export interface PostWalletTransactionInput {
  organizationId: string;
  walletId: string;
  type: "deposit" | "withdrawal" | "allocation" | "refund" | "adjustment";
  amountCents: number;
  currency?: string;
  status?: "pending" | "completed" | "failed" | "cancelled";
  description?: string;
  externalReference?: string;
  idempotencyKey?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export async function postWalletTransaction(
  input: PostWalletTransactionInput,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("post_wallet_transaction", {
    p_organization_id: input.organizationId,
    p_wallet_id: input.walletId,
    p_type: input.type,
    p_amount_cents: input.amountCents,
    p_currency: input.currency ?? "USD",
    p_status: input.status ?? "completed",
    p_description: input.description ?? null,
    p_external_reference: input.externalReference ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_created_by: input.createdBy ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data);
}

export interface CreatePaymentIntentInput {
  organizationId: string;
  walletId: string;
  amountCents: number;
  currency: string;
  provider: DbPaymentProvider;
  createdBy: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntentRecord {
  id: string;
  organizationId: string;
  walletId: string;
  amountCents: number;
  currency: string;
  provider: DbPaymentProvider;
  status: DbPaymentStatus;
  providerReference: string | null;
  checkoutUrl: string | null;
  idempotencyKey: string | null;
}

export async function createPaymentIntentRecord(
  input: CreatePaymentIntentInput,
): Promise<PaymentIntentRecord> {
  const admin = createAdminClient();
  const idempotencyKey = input.idempotencyKey ?? randomUUID();

  const { data, error } = await admin
    .from("payment_intents")
    .insert({
      organization_id: input.organizationId,
      wallet_id: input.walletId,
      amount_cents: input.amountCents,
      currency: input.currency,
      provider: input.provider,
      status: "created",
      idempotency_key: idempotencyKey,
      created_by: input.createdBy,
      metadata: input.metadata ?? {},
    })
    .select(
      "id, organization_id, wallet_id, amount_cents, currency, provider, status, provider_reference, checkout_url, idempotency_key",
    )
    .single();

  if (error) {
    if (error.code === "23505" && input.idempotencyKey) {
      const { data: existing } = await admin
        .from("payment_intents")
        .select(
          "id, organization_id, wallet_id, amount_cents, currency, provider, status, provider_reference, checkout_url, idempotency_key",
        )
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();
      if (existing) return mapIntentRow(existing);
    }
    throw new Error(error.message);
  }

  return mapIntentRow(data);
}

export async function updatePaymentIntentRecord(
  id: string,
  patch: {
    status?: DbPaymentStatus;
    providerReference?: string | null;
    checkoutUrl?: string | null;
    metadata?: Record<string, unknown>;
    succeededAt?: string | null;
    failureReason?: string | null;
    canceledAt?: string | null;
  },
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_intents")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.providerReference !== undefined
        ? { provider_reference: patch.providerReference }
        : {}),
      ...(patch.checkoutUrl !== undefined ? { checkout_url: patch.checkoutUrl } : {}),
      ...(patch.metadata ? { metadata: patch.metadata } : {}),
      ...(patch.succeededAt !== undefined ? { succeeded_at: patch.succeededAt } : {}),
      ...(patch.failureReason !== undefined
        ? { failure_reason: patch.failureReason }
        : {}),
      ...(patch.canceledAt !== undefined ? { canceled_at: patch.canceledAt } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getPaymentIntentByIdInternal(
  id: string,
): Promise<PaymentIntentRecord | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_intents")
    .select(
      "id, organization_id, wallet_id, amount_cents, currency, provider, status, provider_reference, checkout_url, idempotency_key",
    )
    .eq("id", id)
    .maybeSingle();

  return data ? mapIntentRow(data) : null;
}

export async function getPaymentIntentById(
  id: string,
  organizationId: string,
): Promise<PaymentIntentRecord | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_intents")
    .select(
      "id, organization_id, wallet_id, amount_cents, currency, provider, status, provider_reference, checkout_url, idempotency_key",
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  return data ? mapIntentRow(data) : null;
}

export async function getPaymentIntentByProviderReference(
  provider: DbPaymentProvider,
  providerReference: string,
): Promise<PaymentIntentRecord | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_intents")
    .select(
      "id, organization_id, wallet_id, amount_cents, currency, provider, status, provider_reference, checkout_url, idempotency_key",
    )
    .eq("provider", provider)
    .eq("provider_reference", providerReference)
    .maybeSingle();

  return data ? mapIntentRow(data) : null;
}

function mapIntentRow(row: {
  id: string;
  organization_id: string;
  wallet_id: string;
  amount_cents: number;
  currency: string;
  provider: DbPaymentProvider;
  status: DbPaymentStatus;
  provider_reference: string | null;
  checkout_url: string | null;
  idempotency_key: string | null;
}): PaymentIntentRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    walletId: row.wallet_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    provider: row.provider,
    status: row.status,
    providerReference: row.provider_reference,
    checkoutUrl: row.checkout_url,
    idempotencyKey: row.idempotency_key,
  };
}

export async function recordWebhookEvent(input: {
  provider: string;
  eventId: string;
  eventType?: string;
  payload: Record<string, unknown>;
}): Promise<{ duplicate: boolean; id?: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("webhook_events")
    .insert({
      provider: input.provider,
      event_id: input.eventId,
      event_type: input.eventType ?? null,
      payload: input.payload,
      status: "received",
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error?.code === "23505") {
    return { duplicate: true };
  }
  if (error) throw new Error(error.message);
  return { duplicate: false, id: data?.id };
}

export async function markWebhookEventProcessed(
  provider: string,
  eventId: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("webhook_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("provider", provider)
    .eq("event_id", eventId);
}

export async function markWebhookEventFailed(
  provider: string,
  eventId: string,
  errorMessage: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("webhook_events")
    .update({
      status: "failed",
      processed_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("provider", provider)
    .eq("event_id", eventId);
}
