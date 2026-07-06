import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export interface LedgerWalletBalance {
  walletId: string;
  organizationId: string;
  currency: string;
  availableBalanceCents: number;
  reservedBalanceCents: number;
}

export interface LedgerAdAccountBalance {
  adAccountId: string;
  organizationId: string;
  walletId: string;
  currency: string;
  availableBalanceCents: number;
  reservedBalanceCents: number;
  lifetimeSpendCents: number;
}

export interface LedgerConfirmDepositInput {
  paymentIntentId: string;
  providerReference?: string | null;
  idempotencyKey?: string | null;
  webhookEventId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LedgerAllocationInput {
  organizationId?: string;
  adAccountId: string;
  amountCents: number;
  idempotencyKey?: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LedgerAdSpendInput {
  organizationId?: string;
  adAccountId: string;
  amountCents: number;
  occurredAt?: string;
  externalSpendId?: string | null;
  campaignId?: string | null;
  adSetId?: string | null;
  adId?: string | null;
  spendSource?: "available" | "reserved";
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function assertAdAccountBelongsToOrganization(
  admin: ReturnType<typeof createAdminClient>,
  adAccountId: string,
  organizationId?: string,
): Promise<void> {
  if (!organizationId) return;

  const { data, error } = await admin
    .from("ad_accounts")
    .select("organization_id")
    .eq("id", adAccountId)
    .maybeSingle<{ organization_id: string }>();

  if (error) throw new Error(error.message);
  if (!data || data.organization_id !== organizationId) {
    throw new Error("La cuenta publicitaria no pertenece a la organización activa.");
  }
}

export async function confirmDepositInLedger(
  input: LedgerConfirmDepositInput,
): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("ledger_confirm_deposit", {
    p_payment_intent_id: input.paymentIntentId,
    p_provider_reference: input.providerReference ?? null,
    p_idempotency_key:
      input.idempotencyKey ??
      (input.webhookEventId
        ? `ledger:deposit:webhook:${input.webhookEventId}`
        : `ledger:deposit:payment_intent:${input.paymentIntentId}`),
    p_metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function allocateToAdAccount(
  input: LedgerAllocationInput,
): Promise<string> {
  const admin = createAdminClient();
  await assertAdAccountBelongsToOrganization(admin, input.adAccountId, input.organizationId);
  const idempotencyKey =
    input.idempotencyKey ??
    `allocation:${input.adAccountId}:${input.amountCents}:${randomUUID()}`;

  const { data, error } = await admin.rpc("ledger_allocate_to_ad_account", {
    p_ad_account_id: input.adAccountId,
    p_amount_cents: input.amountCents,
    p_idempotency_key: idempotencyKey,
    p_description: input.description ?? "Asignación a cuenta publicitaria",
    p_metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function reserveAdAccountBudget(
  input: LedgerAllocationInput,
): Promise<string> {
  const admin = createAdminClient();
  await assertAdAccountBelongsToOrganization(admin, input.adAccountId, input.organizationId);
  const idempotencyKey =
    input.idempotencyKey ??
    `reserve:${input.adAccountId}:${input.amountCents}:${randomUUID()}`;

  const { data, error } = await admin.rpc("ledger_reserve_ad_account_budget", {
    p_ad_account_id: input.adAccountId,
    p_amount_cents: input.amountCents,
    p_idempotency_key: idempotencyKey,
    p_description: input.description ?? "Reserva de presupuesto publicitario",
    p_metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function releaseAdAccountBudget(
  input: LedgerAllocationInput,
): Promise<string> {
  const admin = createAdminClient();
  await assertAdAccountBelongsToOrganization(admin, input.adAccountId, input.organizationId);
  const idempotencyKey =
    input.idempotencyKey ??
    `release:${input.adAccountId}:${input.amountCents}:${randomUUID()}`;

  const { data, error } = await admin.rpc("ledger_release_ad_account_budget", {
    p_ad_account_id: input.adAccountId,
    p_amount_cents: input.amountCents,
    p_idempotency_key: idempotencyKey,
    p_description: input.description ?? "Liberación de presupuesto publicitario",
    p_metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function recordAdSpendInLedger(
  input: LedgerAdSpendInput,
): Promise<string> {
  const admin = createAdminClient();
  await assertAdAccountBelongsToOrganization(admin, input.adAccountId, input.organizationId);
  const idempotencyKey =
    input.idempotencyKey ??
    (input.externalSpendId
      ? `ad_spend:${input.adAccountId}:${input.externalSpendId}`
      : `ad_spend:${input.adAccountId}:${input.amountCents}:${randomUUID()}`);

  const { data, error } = await admin.rpc("ledger_record_ad_spend", {
    p_ad_account_id: input.adAccountId,
    p_amount_cents: input.amountCents,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    p_external_spend_id: input.externalSpendId ?? null,
    p_campaign_id: input.campaignId ?? null,
    p_ad_set_id: input.adSetId ?? null,
    p_ad_id: input.adId ?? null,
    p_spend_source: input.spendSource ?? "available",
    p_idempotency_key: idempotencyKey,
    p_metadata: input.metadata ?? {},
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export const recordProviderAdSpend = recordAdSpendInLedger;

export async function ensureWalletLedgerAccounts(walletId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("ensure_wallet_ledger_accounts", {
    p_wallet_id: walletId,
  });
  if (error) throw new Error(error.message);
}

export async function ensureAdAccountLedgerAccounts(adAccountId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("ensure_ad_account_ledger_accounts", {
    p_ad_account_id: adAccountId,
  });
  if (error) throw new Error(error.message);
}

export async function getWalletLedgerBalance(
  organizationId: string,
): Promise<LedgerWalletBalance | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("v_wallet_ledger_balances")
    .select(
      "wallet_id, organization_id, currency, available_balance_cents, reserved_balance_cents",
    )
    .eq("organization_id", organizationId)
    .maybeSingle<{
      wallet_id: string;
      organization_id: string;
      currency: string;
      available_balance_cents: number;
      reserved_balance_cents: number;
    }>();

  if (error || !data) return null;

  return {
    walletId: data.wallet_id,
    organizationId: data.organization_id,
    currency: data.currency,
    availableBalanceCents: toNumber(data.available_balance_cents),
    reservedBalanceCents: toNumber(data.reserved_balance_cents),
  };
}

export async function getAdAccountLedgerBalances(
  organizationId: string,
): Promise<Map<string, LedgerAdAccountBalance>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("v_ad_account_ledger_balances")
    .select(
      "ad_account_id, organization_id, wallet_id, currency, available_balance_cents, reserved_balance_cents, lifetime_spend_cents",
    )
    .eq("organization_id", organizationId);

  if (error || !data) return new Map();

  return new Map(
    data.map((row) => [
      row.ad_account_id,
      {
        adAccountId: row.ad_account_id,
        organizationId: row.organization_id,
        walletId: row.wallet_id,
        currency: row.currency,
        availableBalanceCents: toNumber(row.available_balance_cents),
        reservedBalanceCents: toNumber(row.reserved_balance_cents),
        lifetimeSpendCents: toNumber(row.lifetime_spend_cents),
      },
    ]),
  );
}

export async function listFinancialActivity(input: {
  organizationId: string;
  journalTypes?: string[];
  limit?: number;
}): Promise<Array<{
  id: string;
  journalType: string;
  amountCents: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
}>> {
  const admin = createAdminClient();
  let query = admin
    .from("ledger_journals")
    .select("id, journal_type, amount_cents, currency, status, description, created_at")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 25);

  if (input.journalTypes?.length) {
    query = query.in("journal_type", input.journalTypes);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    journalType: row.journal_type,
    amountCents: toNumber(row.amount_cents),
    currency: row.currency,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
  }));
}
