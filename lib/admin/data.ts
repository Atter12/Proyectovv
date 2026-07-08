import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecord } from "@/lib/types/json";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  status?: string | null;
  email_verified?: boolean | null;
  onboarding_status?: string | null;
  last_active_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  legal_name?: string | null;
  tax_id?: string | null;
  website_url?: string | null;
  logo_url?: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  country?: string | null;
  billing_email?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface WalletRow {
  id: string;
  organization_id: string;
  name: string;
  currency: string;
  balance_cents: number;
  reserved_balance_cents?: number | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PaymentIntentRow {
  id: string;
  organization_id: string;
  wallet_id: string;
  amount_cents: number;
  currency: string;
  provider: string;
  provider_reference: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  failure_reason?: string | null;
  checkout_url?: string | null;
  succeeded_at?: string | null;
  canceled_at?: string | null;
}

export interface WalletTransactionRow {
  id: string;
  wallet_id: string;
  organization_id: string;
  type: string;
  amount_cents: number;
  currency: string;
  status: string;
  balance_after_cents: number | null;
  description: string | null;
  external_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  idempotency_key?: string | null;
}

export interface AdAccountRow {
  id: string;
  organization_id: string;
  name: string;
  platform: string;
  external_account_id: string | null;
  external_business_id?: string | null;
  external_account_name?: string | null;
  status: string;
  daily_budget_cents: number;
  monthly_limit_cents?: number | null;
  auto_recharge_enabled?: boolean | null;
  recharge_threshold_cents?: number | null;
  currency: string;
  timezone?: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  last_synced_at?: string | null;
}

export interface AdAccountBalanceRow {
  ad_account_id: string;
  organization_id: string;
  balance_cents: number;
  reserved_balance_cents?: number | null;
  currency: string;
  updated_at?: string | null;
}

export interface SupportTicketRow {
  id: string;
  organization_id: string | null;
  requester_user_id: string | null;
  assigned_user_id: string | null;
  subject: string;
  status: string;
  priority: string;
  category: string | null;
  metadata: Record<string, unknown> | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SupportMessageRow {
  id: string;
  ticket_id: string;
  organization_id: string | null;
  sender_user_id: string | null;
  body: string;
  attachments: unknown[] | null;
  internal_note: boolean;
  created_at: string;
}

export interface ReferralCodeRow {
  id: string;
  organization_id: string;
  user_id: string;
  code: string;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface ReferralRow {
  id: string;
  referral_code_id: string;
  referrer_user_id: string | null;
  referred_organization_id: string | null;
  status: string;
  commission_rate: number;
  commission_amount_cents: number;
  created_at: string;
  converted_at: string | null;
  approved_at?: string | null;
  paid_at?: string | null;
  wallet_transaction_id?: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CreativeAssetRow {
  id: string;
  organization_id: string;
  name: string;
  asset_type: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  public_url: string | null;
  thumbnail_url: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreativeAnalysisJobRow {
  id: string;
  organization_id: string;
  creative_asset_id: string | null;
  status: string;
  provider: string;
  model: string | null;
  prompt_version: string | null;
  input: Record<string, unknown> | null;
  error_message: string | null;
  requested_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface CreativeAnalysisResultRow {
  id: string;
  organization_id: string;
  job_id: string;
  creative_asset_id: string | null;
  overall_score: number | null;
  clarity_score: number | null;
  brand_score: number | null;
  compliance_score: number | null;
  recommendations: unknown[] | null;
  detected_issues: unknown[] | null;
  raw_output: Record<string, unknown> | null;
  created_at: string;
}

export interface LedgerJournalRow {
  id: string;
  organization_id: string;
  wallet_id: string;
  journal_type: string;
  status: string;
  amount_cents: number;
  currency: string;
  source_table: string | null;
  source_id: string | null;
  provider: string | null;
  provider_reference: string | null;
  idempotency_key: string | null;
  reversal_of_journal_id?: string | null;
  reversed_by_journal_id?: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  posted_at: string | null;
  created_at: string;
}

export interface LedgerEntryRow {
  id: string;
  journal_id: string;
  organization_id: string;
  wallet_id: string;
  account_id: string;
  direction: string;
  amount_cents: number;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ReconciliationRunRow {
  id: string;
  organization_id: string | null;
  provider: string;
  reconciliation_type: string;
  period_start: string | null;
  period_end: string | null;
  status: string;
  totals: Record<string, unknown> | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string;
  finished_at: string | null;
  created_by: string | null;
}

export interface ReconciliationItemRow {
  id: string;
  reconciliation_run_id: string;
  organization_id: string | null;
  item_type: string;
  source_reference: string | null;
  ledger_journal_id: string | null;
  status: string;
  provider_amount_cents: number | null;
  ledger_amount_cents: number | null;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface WebhookEventRow {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  status: string;
  payload: Record<string, unknown> | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  severity: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  request_id?: string | null;
  trace_id?: string | null;
}

export interface IntegrationConnectionRow {
  id: string;
  organization_id: string;
  provider: string;
  name: string;
  status: string;
  external_account_id: string | null;
  scopes: string[] | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ApiKeyRow {
  id: string;
  organization_id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | null;
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Enriched<T> {
  row: T;
  organization?: OrganizationRow;
  actor?: ProfileRow;
  requester?: ProfileRow;
  assignee?: ProfileRow;
  wallet?: WalletRow;
}

function rows<T>(data: T[] | null | undefined): T[] {
  return Array.isArray(data) ? data : [];
}

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function containsText(values: Array<string | null | undefined>, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return values.some((value) => (value ?? "").toLowerCase().includes(needle));
}

export function getManualProof(metadata: unknown): { storagePath?: string; fileName?: string; publicUrl?: string; signedUrl?: string; uploadedAt?: string; notes?: string } | null {
  if (!isRecord(metadata)) return null;
  const proof = metadata.manual_proof;
  if (!isRecord(proof)) return null;
  return {
    storagePath: typeof proof.storage_path === "string" ? proof.storage_path : undefined,
    fileName: typeof proof.file_name === "string" ? proof.file_name : undefined,
    publicUrl: typeof proof.public_url === "string" ? proof.public_url : undefined,
    signedUrl: typeof proof.signed_url === "string" ? proof.signed_url : undefined,
    uploadedAt: typeof proof.uploaded_at === "string" ? proof.uploaded_at : undefined,
    notes: typeof proof.notes === "string" ? proof.notes : undefined,
  };
}

export async function getOrganizationMap(ids: string[]): Promise<Map<string, OrganizationRow>> {
  if (ids.length === 0) return new Map();
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id, name, slug, legal_name, tax_id, website_url, logo_url, status, created_by, created_at, updated_at, country, billing_email, metadata")
    .in("id", ids);
  return new Map(rows(data as OrganizationRow[] | null).map((org) => [org.id, org]));
}

export async function getProfileMap(ids: string[]): Promise<Map<string, ProfileRow>> {
  if (ids.length === 0) return new Map();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, phone, status, email_verified, onboarding_status, last_active_at, created_at, updated_at")
    .in("id", ids);
  return new Map(rows(data as ProfileRow[] | null).map((profile) => [profile.id, profile]));
}

export async function getWalletMap(ids: string[]): Promise<Map<string, WalletRow>> {
  if (ids.length === 0) return new Map();
  const admin = createAdminClient();
  const { data } = await admin
    .from("wallets")
    .select("id, organization_id, name, currency, balance_cents, reserved_balance_cents, status, created_at, updated_at")
    .in("id", ids);
  return new Map(rows(data as WalletRow[] | null).map((wallet) => [wallet.id, wallet]));
}

async function safeCount(table: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export async function getOverviewData() {
  const admin = createAdminClient();

  const [
    profileCount,
    orgCount,
    pendingPaymentsResult,
    pendingRefundsResult,
    openTicketsResult,
    failedWebhooksResult,
  ] = await Promise.all([
    safeCount("profiles"),
    safeCount("organizations"),
    admin.from("payment_intents").select("*", { count: "exact", head: true }).eq("provider", "manual").in("status", ["created", "requires_payment", "processing"]),
    admin.from("wallet_transactions").select("*", { count: "exact", head: true }).eq("type", "refund").eq("status", "pending"),
    admin.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "pending"]),
    admin.from("webhook_events").select("*", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  const pendingPaymentsCount = pendingPaymentsResult.count ?? 0;
  const pendingRefundsCount = pendingRefundsResult.count ?? 0;
  const openTicketsCount = openTicketsResult.count ?? 0;
  const failedWebhooksCount = failedWebhooksResult.count ?? 0;

  const { data: walletsData } = await admin.from("wallets").select("balance_cents, reserved_balance_cents, currency, status");
  const wallets = rows(walletsData as Array<{ balance_cents: number; reserved_balance_cents: number | null; currency: string; status: string }> | null);
  const totalWalletBalanceCents = wallets.reduce((sum, wallet) => sum + Number(wallet.balance_cents ?? 0), 0);
  const totalReservedCents = wallets.reduce((sum, wallet) => sum + Number(wallet.reserved_balance_cents ?? 0), 0);
  const primaryCurrency = wallets[0]?.currency ?? "USD";

  const { data: paymentsData } = await admin
    .from("payment_intents")
    .select("id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, metadata, created_by, created_at, updated_at, failure_reason, checkout_url, succeeded_at, canceled_at")
    .order("created_at", { ascending: false })
    .limit(8);

  const { data: ticketsData } = await admin
    .from("support_tickets")
    .select("id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, metadata, closed_at, created_at, updated_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(8);

  const { data: auditData } = await admin
    .from("audit_logs")
    .select("id, organization_id, actor_user_id, action, entity_type, entity_id, severity, metadata, created_at, request_id, trace_id")
    .order("created_at", { ascending: false })
    .limit(8);

  const recentPayments = rows(paymentsData as PaymentIntentRow[] | null);
  const recentTickets = rows(ticketsData as SupportTicketRow[] | null);
  const recentAudit = rows(auditData as AuditLogRow[] | null);
  const orgMap = await getOrganizationMap(unique([
    ...recentPayments.map((row) => row.organization_id),
    ...recentTickets.map((row) => row.organization_id),
    ...recentAudit.map((row) => row.organization_id),
  ]));
  const profileMap = await getProfileMap(unique([
    ...recentPayments.map((row) => row.created_by),
    ...recentTickets.map((row) => row.requester_user_id),
    ...recentAudit.map((row) => row.actor_user_id),
  ]));

  return {
    counts: {
      profiles: profileCount,
      organizations: orgCount,
      pendingPayments: pendingPaymentsCount,
      pendingRefunds: pendingRefundsCount,
      openTickets: openTicketsCount,
      failedWebhooks: failedWebhooksCount,
      totalWalletBalanceCents,
      totalReservedCents,
      primaryCurrency,
    },
    recentPayments: recentPayments.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.created_by ? profileMap.get(row.created_by) : undefined })),
    recentTickets: recentTickets.map((row) => ({ row, organization: row.organization_id ? orgMap.get(row.organization_id) : undefined, requester: row.requester_user_id ? profileMap.get(row.requester_user_id) : undefined })),
    recentAudit: recentAudit.map((row) => ({ row, organization: row.organization_id ? orgMap.get(row.organization_id) : undefined, actor: row.actor_user_id ? profileMap.get(row.actor_user_id) : undefined })),
  };
}

export async function listManualPayments(filters: { status?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("payment_intents")
    .select("id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, metadata, created_by, created_at, updated_at, failure_reason, checkout_url, succeeded_at, canceled_at")
    .eq("provider", "manual")
    .order("created_at", { ascending: false })
    .limit(120);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data } = await query;
  let payments = rows(data as PaymentIntentRow[] | null);
  const orgMap = await getOrganizationMap(unique(payments.map((row) => row.organization_id)));
  const profileMap = await getProfileMap(unique(payments.map((row) => row.created_by)));
  const walletMap = await getWalletMap(unique(payments.map((row) => row.wallet_id)));

  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    payments = payments.filter((payment) => {
      const org = orgMap.get(payment.organization_id);
      const actor = payment.created_by ? profileMap.get(payment.created_by) : undefined;
      return containsText([payment.id, payment.provider_reference, org?.name, org?.slug, actor?.email], q);
    });
  }

  return payments.map((row) => ({
    row,
    organization: orgMap.get(row.organization_id),
    actor: row.created_by ? profileMap.get(row.created_by) : undefined,
    wallet: walletMap.get(row.wallet_id),
    proof: getManualProof(row.metadata),
  }));
}

export async function getManualPaymentDetail(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payment_intents")
    .select("id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, metadata, created_by, created_at, updated_at, failure_reason, checkout_url, succeeded_at, canceled_at")
    .eq("id", id)
    .maybeSingle<PaymentIntentRow>();
  if (!data) return null;
  const [orgMap, profileMap, walletMap] = await Promise.all([
    getOrganizationMap([data.organization_id]),
    getProfileMap(unique([data.created_by])),
    getWalletMap([data.wallet_id]),
  ]);
  const { data: journals } = await admin
    .from("ledger_journals")
    .select("id, organization_id, wallet_id, journal_type, status, amount_cents, currency, source_table, source_id, provider, provider_reference, idempotency_key, reversal_of_journal_id, reversed_by_journal_id, description, metadata, created_by, posted_at, created_at")
    .eq("source_table", "payment_intents")
    .eq("source_id", id)
    .order("created_at", { ascending: false });
  const { data: audit } = await admin
    .from("audit_logs")
    .select("id, organization_id, actor_user_id, action, entity_type, entity_id, severity, metadata, created_at, request_id, trace_id")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  return {
    row: data,
    organization: orgMap.get(data.organization_id),
    actor: data.created_by ? profileMap.get(data.created_by) : undefined,
    wallet: walletMap.get(data.wallet_id),
    proof: getManualProof(data.metadata),
    journals: rows(journals as LedgerJournalRow[] | null),
    audit: rows(audit as AuditLogRow[] | null),
  };
}

export async function listRefundRequests(filters: { status?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("wallet_transactions")
    .select("id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, metadata, created_by, created_at, idempotency_key")
    .eq("type", "refund")
    .order("created_at", { ascending: false })
    .limit(120);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data } = await query;
  let refunds = rows(data as WalletTransactionRow[] | null);
  const orgMap = await getOrganizationMap(unique(refunds.map((row) => row.organization_id)));
  const profileMap = await getProfileMap(unique(refunds.map((row) => row.created_by)));
  const walletMap = await getWalletMap(unique(refunds.map((row) => row.wallet_id)));
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    refunds = refunds.filter((refund) => {
      const org = orgMap.get(refund.organization_id);
      const actor = refund.created_by ? profileMap.get(refund.created_by) : undefined;
      return containsText([refund.id, refund.description, org?.name, org?.slug, actor?.email], q);
    });
  }
  return refunds.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.created_by ? profileMap.get(row.created_by) : undefined, wallet: walletMap.get(row.wallet_id) }));
}

export async function listOrganizations(filters: { q?: string; status?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("organizations")
    .select("id, name, slug, legal_name, tax_id, website_url, logo_url, status, created_by, created_at, updated_at, country, billing_email, metadata")
    .order("created_at", { ascending: false })
    .limit(120);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data } = await query;
  let orgs = rows(data as OrganizationRow[] | null);
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) orgs = orgs.filter((org) => containsText([org.name, org.slug, org.legal_name, org.tax_id, org.billing_email], q));

  const orgIds = orgs.map((org) => org.id);
  const [walletsResult, adAccountsResult, membershipsResult] = await Promise.all([
    admin.from("wallets").select("id, organization_id, name, currency, balance_cents, reserved_balance_cents, status, created_at, updated_at").in("organization_id", orgIds),
    admin.from("ad_accounts").select("id, organization_id, status").in("organization_id", orgIds),
    admin.from("organization_memberships").select("id, organization_id, status").in("organization_id", orgIds),
  ]);
  const wallets = rows(walletsResult.data as WalletRow[] | null);
  const adAccounts = rows(adAccountsResult.data as Array<{ id: string; organization_id: string; status: string }> | null);
  const memberships = rows(membershipsResult.data as Array<{ id: string; organization_id: string; status: string }> | null);

  return orgs.map((org) => ({
    row: org,
    wallets: wallets.filter((wallet) => wallet.organization_id === org.id),
    adAccountCount: adAccounts.filter((account) => account.organization_id === org.id).length,
    activeMembers: memberships.filter((member) => member.organization_id === org.id && member.status === "active").length,
  }));
}

export async function getOrganizationDetail(id: string) {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug, legal_name, tax_id, website_url, logo_url, status, created_by, created_at, updated_at, country, billing_email, metadata")
    .eq("id", id)
    .maybeSingle<OrganizationRow>();
  if (!org) return null;

  const [walletsResult, membershipsResult, adAccountsResult, paymentsResult, refundsResult, ticketsResult, journalsResult, referralsResult] = await Promise.all([
    admin.from("wallets").select("id, organization_id, name, currency, balance_cents, reserved_balance_cents, status, created_at, updated_at").eq("organization_id", id),
    admin.from("organization_memberships").select("id, organization_id, user_id, role, status, is_default, created_at, updated_at").eq("organization_id", id),
    admin.from("ad_accounts").select("id, organization_id, name, platform, external_account_id, external_business_id, external_account_name, status, daily_budget_cents, monthly_limit_cents, auto_recharge_enabled, recharge_threshold_cents, currency, timezone, metadata, created_by, created_at, updated_at, last_synced_at").eq("organization_id", id).order("created_at", { ascending: false }),
    admin.from("payment_intents").select("id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, metadata, created_by, created_at, updated_at, failure_reason, checkout_url, succeeded_at, canceled_at").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("wallet_transactions").select("id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, metadata, created_by, created_at, idempotency_key").eq("organization_id", id).eq("type", "refund").order("created_at", { ascending: false }).limit(20),
    admin.from("support_tickets").select("id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, metadata, closed_at, created_at, updated_at").eq("organization_id", id).order("updated_at", { ascending: false, nullsFirst: false }).limit(20),
    admin.from("ledger_journals").select("id, organization_id, wallet_id, journal_type, status, amount_cents, currency, source_table, source_id, provider, provider_reference, idempotency_key, reversal_of_journal_id, reversed_by_journal_id, description, metadata, created_by, posted_at, created_at").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("referrals").select("id, referral_code_id, referrer_user_id, referred_organization_id, status, commission_rate, commission_amount_cents, created_at, converted_at, approved_at, paid_at, wallet_transaction_id, metadata").or(`referred_organization_id.eq.${id}`).order("created_at", { ascending: false }).limit(20),
  ]);

  const memberships = rows(membershipsResult.data as Array<{ id: string; organization_id: string; user_id: string; role: string; status: string; is_default?: boolean; created_at: string; updated_at?: string | null }> | null);
  const profileMap = await getProfileMap(unique([org.created_by, ...memberships.map((member) => member.user_id)]));

  return {
    row: org,
    createdByProfile: org.created_by ? profileMap.get(org.created_by) : undefined,
    wallets: rows(walletsResult.data as WalletRow[] | null),
    memberships: memberships.map((membership) => ({ row: membership, profile: profileMap.get(membership.user_id) })),
    adAccounts: rows(adAccountsResult.data as AdAccountRow[] | null),
    payments: rows(paymentsResult.data as PaymentIntentRow[] | null),
    refunds: rows(refundsResult.data as WalletTransactionRow[] | null),
    tickets: rows(ticketsResult.data as SupportTicketRow[] | null),
    journals: rows(journalsResult.data as LedgerJournalRow[] | null),
    referrals: rows(referralsResult.data as ReferralRow[] | null),
  };
}

export async function listUsers(filters: { q?: string; status?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("id, email, full_name, avatar_url, phone, status, email_verified, onboarding_status, last_active_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(150);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data } = await query;
  let profiles = rows(data as ProfileRow[] | null);
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) profiles = profiles.filter((profile) => containsText([profile.email, profile.full_name, profile.phone], q));
  const userIds = profiles.map((profile) => profile.id);
  const { data: membershipsData } = await admin
    .from("organization_memberships")
    .select("id, organization_id, user_id, role, status, is_default, created_at")
    .in("user_id", userIds);
  const memberships = rows(membershipsData as Array<{ id: string; organization_id: string; user_id: string; role: string; status: string; is_default?: boolean; created_at: string }> | null);
  const orgMap = await getOrganizationMap(unique(memberships.map((member) => member.organization_id)));
  return profiles.map((profile) => ({
    row: profile,
    memberships: memberships.filter((member) => member.user_id === profile.id).map((member) => ({ row: member, organization: orgMap.get(member.organization_id) })),
  }));
}

export async function listAdAccounts(filters: { status?: string; platform?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("ad_accounts")
    .select("id, organization_id, name, platform, external_account_id, external_business_id, external_account_name, status, daily_budget_cents, monthly_limit_cents, auto_recharge_enabled, recharge_threshold_cents, currency, timezone, metadata, created_by, created_at, updated_at, last_synced_at")
    .order("created_at", { ascending: false })
    .limit(150);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.platform && filters.platform !== "all") query = query.eq("platform", filters.platform);
  const { data } = await query;
  let accounts = rows(data as AdAccountRow[] | null);
  const orgMap = await getOrganizationMap(unique(accounts.map((row) => row.organization_id)));
  const profileMap = await getProfileMap(unique(accounts.map((row) => row.created_by)));
  const { data: balancesData } = await admin
    .from("ad_account_balances")
    .select("ad_account_id, organization_id, balance_cents, reserved_balance_cents, currency, updated_at")
    .in("ad_account_id", accounts.map((account) => account.id));
  const balanceMap = new Map(rows(balancesData as AdAccountBalanceRow[] | null).map((balance) => [balance.ad_account_id, balance]));
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    accounts = accounts.filter((account) => {
      const org = orgMap.get(account.organization_id);
      return containsText([account.name, account.external_account_id, account.external_business_id, account.external_account_name, org?.name, org?.slug], q);
    });
  }
  return accounts.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.created_by ? profileMap.get(row.created_by) : undefined, balance: balanceMap.get(row.id) }));
}

export async function listSupportTickets(filters: { status?: string; priority?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("support_tickets")
    .select("id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, metadata, closed_at, created_at, updated_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(150);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.priority && filters.priority !== "all") query = query.eq("priority", filters.priority);
  const { data } = await query;
  let tickets = rows(data as SupportTicketRow[] | null);
  const orgMap = await getOrganizationMap(unique(tickets.map((row) => row.organization_id)));
  const profileMap = await getProfileMap(unique([...tickets.map((row) => row.requester_user_id), ...tickets.map((row) => row.assigned_user_id)]));
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    tickets = tickets.filter((ticket) => {
      const org = ticket.organization_id ? orgMap.get(ticket.organization_id) : undefined;
      const requester = ticket.requester_user_id ? profileMap.get(ticket.requester_user_id) : undefined;
      return containsText([ticket.subject, ticket.category, org?.name, org?.slug, requester?.email], q);
    });
  }
  return tickets.map((row) => ({
    row,
    organization: row.organization_id ? orgMap.get(row.organization_id) : undefined,
    requester: row.requester_user_id ? profileMap.get(row.requester_user_id) : undefined,
    assignee: row.assigned_user_id ? profileMap.get(row.assigned_user_id) : undefined,
  }));
}

export async function getSupportTicketDetail(id: string) {
  const admin = createAdminClient();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, metadata, closed_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle<SupportTicketRow>();
  if (!ticket) return null;
  const { data: messagesData } = await admin
    .from("support_messages")
    .select("id, ticket_id, organization_id, sender_user_id, body, attachments, internal_note, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  const messages = rows(messagesData as SupportMessageRow[] | null);
  const [orgMap, profileMap] = await Promise.all([
    getOrganizationMap(unique([ticket.organization_id])),
    getProfileMap(unique([ticket.requester_user_id, ticket.assigned_user_id, ...messages.map((message) => message.sender_user_id)])),
  ]);
  return {
    row: ticket,
    organization: ticket.organization_id ? orgMap.get(ticket.organization_id) : undefined,
    requester: ticket.requester_user_id ? profileMap.get(ticket.requester_user_id) : undefined,
    assignee: ticket.assigned_user_id ? profileMap.get(ticket.assigned_user_id) : undefined,
    messages: messages.map((message) => ({ row: message, sender: message.sender_user_id ? profileMap.get(message.sender_user_id) : undefined })),
  };
}

export async function listAffiliates(filters: { status?: string; q?: string } = {}) {
  const admin = createAdminClient();
  const [codesResult, referralsResult] = await Promise.all([
    admin.from("referral_codes").select("id, organization_id, user_id, code, status, created_at, metadata").order("created_at", { ascending: false }).limit(150),
    admin.from("referrals").select("id, referral_code_id, referrer_user_id, referred_organization_id, status, commission_rate, commission_amount_cents, created_at, converted_at, approved_at, paid_at, wallet_transaction_id, metadata").order("created_at", { ascending: false }).limit(200),
  ]);
  let codes = rows(codesResult.data as ReferralCodeRow[] | null);
  let referrals = rows(referralsResult.data as ReferralRow[] | null);
  if (filters.status && filters.status !== "all") {
    codes = codes.filter((code) => code.status === filters.status);
    referrals = referrals.filter((referral) => referral.status === filters.status);
  }
  const orgMap = await getOrganizationMap(unique([...codes.map((row) => row.organization_id), ...referrals.map((row) => row.referred_organization_id)]));
  const profileMap = await getProfileMap(unique([...codes.map((row) => row.user_id), ...referrals.map((row) => row.referrer_user_id)]));
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    codes = codes.filter((code) => {
      const org = orgMap.get(code.organization_id);
      const user = profileMap.get(code.user_id);
      return containsText([code.code, org?.name, org?.slug, user?.email], q);
    });
    referrals = referrals.filter((referral) => {
      const org = referral.referred_organization_id ? orgMap.get(referral.referred_organization_id) : undefined;
      const user = referral.referrer_user_id ? profileMap.get(referral.referrer_user_id) : undefined;
      return containsText([referral.id, org?.name, org?.slug, user?.email], q);
    });
  }
  return {
    codes: codes.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: profileMap.get(row.user_id) })),
    referrals: referrals.map((row) => ({ row, organization: row.referred_organization_id ? orgMap.get(row.referred_organization_id) : undefined, actor: row.referrer_user_id ? profileMap.get(row.referrer_user_id) : undefined })),
  };
}

export async function listCreativeWork(filters: { status?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let jobsQuery = admin
    .from("creative_analysis_jobs")
    .select("id, organization_id, creative_asset_id, status, provider, model, prompt_version, input, error_message, requested_by, started_at, finished_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(150);
  if (filters.status && filters.status !== "all") jobsQuery = jobsQuery.eq("status", filters.status);
  const [jobsResult, assetsResult, resultsResult] = await Promise.all([
    jobsQuery,
    admin.from("creative_assets").select("id, organization_id, name, asset_type, mime_type, file_size_bytes, storage_bucket, storage_path, public_url, thumbnail_url, status, metadata, created_by, created_at, updated_at").order("created_at", { ascending: false }).limit(150),
    admin.from("creative_analysis_results").select("id, organization_id, job_id, creative_asset_id, overall_score, clarity_score, brand_score, compliance_score, recommendations, detected_issues, raw_output, created_at").order("created_at", { ascending: false }).limit(150),
  ]);
  let jobs = rows(jobsResult.data as CreativeAnalysisJobRow[] | null);
  let assets = rows(assetsResult.data as CreativeAssetRow[] | null);
  const results = rows(resultsResult.data as CreativeAnalysisResultRow[] | null);
  const orgMap = await getOrganizationMap(unique([...jobs.map((row) => row.organization_id), ...assets.map((row) => row.organization_id)]));
  const profileMap = await getProfileMap(unique([...jobs.map((row) => row.requested_by), ...assets.map((row) => row.created_by)]));
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const resultMap = new Map(results.map((result) => [result.job_id, result]));
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    jobs = jobs.filter((job) => {
      const org = orgMap.get(job.organization_id);
      const asset = job.creative_asset_id ? assetMap.get(job.creative_asset_id) : undefined;
      return containsText([job.id, job.provider, job.model, org?.name, org?.slug, asset?.name], q);
    });
    assets = assets.filter((asset) => {
      const org = orgMap.get(asset.organization_id);
      return containsText([asset.name, asset.asset_type, asset.mime_type, org?.name, org?.slug], q);
    });
  }
  return {
    jobs: jobs.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.requested_by ? profileMap.get(row.requested_by) : undefined, asset: row.creative_asset_id ? assetMap.get(row.creative_asset_id) : undefined, result: resultMap.get(row.id) })),
    assets: assets.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.created_by ? profileMap.get(row.created_by) : undefined })),
  };
}

export async function listLedger(filters: { status?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("ledger_journals")
    .select("id, organization_id, wallet_id, journal_type, status, amount_cents, currency, source_table, source_id, provider, provider_reference, idempotency_key, reversal_of_journal_id, reversed_by_journal_id, description, metadata, created_by, posted_at, created_at")
    .order("created_at", { ascending: false })
    .limit(150);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data } = await query;
  let journals = rows(data as LedgerJournalRow[] | null);
  const orgMap = await getOrganizationMap(unique(journals.map((row) => row.organization_id)));
  const profileMap = await getProfileMap(unique(journals.map((row) => row.created_by)));
  const walletMap = await getWalletMap(unique(journals.map((row) => row.wallet_id)));
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) {
    journals = journals.filter((journal) => {
      const org = orgMap.get(journal.organization_id);
      return containsText([journal.id, journal.journal_type, journal.source_table, journal.source_id, journal.provider_reference, journal.description, org?.name, org?.slug], q);
    });
  }
  const { data: entriesData } = await admin
    .from("ledger_entries")
    .select("id, journal_id, organization_id, wallet_id, account_id, direction, amount_cents, currency, metadata, created_at")
    .in("journal_id", journals.map((journal) => journal.id));
  const entries = rows(entriesData as LedgerEntryRow[] | null);
  return journals.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.created_by ? profileMap.get(row.created_by) : undefined, wallet: walletMap.get(row.wallet_id), entries: entries.filter((entry) => entry.journal_id === row.id) }));
}

export async function listReconciliation() {
  const admin = createAdminClient();
  const [runsResult, itemsResult] = await Promise.all([
    admin.from("financial_reconciliation_runs").select("id, organization_id, provider, reconciliation_type, period_start, period_end, status, totals, error_message, metadata, started_at, finished_at, created_by").order("started_at", { ascending: false }).limit(80),
    admin.from("financial_reconciliation_items").select("id, reconciliation_run_id, organization_id, item_type, source_reference, ledger_journal_id, status, provider_amount_cents, ledger_amount_cents, currency, metadata, created_at").order("created_at", { ascending: false }).limit(200),
  ]);
  const runs = rows(runsResult.data as ReconciliationRunRow[] | null);
  const items = rows(itemsResult.data as ReconciliationItemRow[] | null);
  const orgMap = await getOrganizationMap(unique([...runs.map((row) => row.organization_id), ...items.map((row) => row.organization_id)]));
  const profileMap = await getProfileMap(unique(runs.map((row) => row.created_by)));
  return {
    runs: runs.map((row) => ({ row, organization: row.organization_id ? orgMap.get(row.organization_id) : undefined, actor: row.created_by ? profileMap.get(row.created_by) : undefined, items: items.filter((item) => item.reconciliation_run_id === row.id) })),
    items: items.map((row) => ({ row, organization: row.organization_id ? orgMap.get(row.organization_id) : undefined })),
  };
}

export async function listWebhooks(filters: { status?: string; provider?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("webhook_events")
    .select("id, provider, event_id, event_type, status, payload, error_message, processed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(150);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.provider && filters.provider !== "all") query = query.eq("provider", filters.provider);
  const { data } = await query;
  let events = rows(data as WebhookEventRow[] | null);
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) events = events.filter((event) => containsText([event.id, event.provider, event.event_id, event.event_type, event.error_message], q));
  return events;
}

export async function listAuditLogs(filters: { severity?: string; q?: string } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("audit_logs")
    .select("id, organization_id, actor_user_id, action, entity_type, entity_id, severity, metadata, created_at, request_id, trace_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters.severity && filters.severity !== "all") query = query.eq("severity", filters.severity);
  const { data } = await query;
  let logs = rows(data as AuditLogRow[] | null);
  const orgMap = await getOrganizationMap(unique(logs.map((row) => row.organization_id)));
  const profileMap = await getProfileMap(unique(logs.map((row) => row.actor_user_id)));
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) logs = logs.filter((log) => containsText([log.action, log.entity_type, log.entity_id, log.request_id, log.trace_id, orgMap.get(log.organization_id ?? "")?.name, profileMap.get(log.actor_user_id ?? "")?.email], q));
  return logs.map((row) => ({ row, organization: row.organization_id ? orgMap.get(row.organization_id) : undefined, actor: row.actor_user_id ? profileMap.get(row.actor_user_id) : undefined }));
}

export async function listIntegrations() {
  const admin = createAdminClient();
  const [connectionsResult, keysResult] = await Promise.all([
    admin.from("integration_connections").select("id, organization_id, provider, name, status, external_account_id, scopes, last_synced_at, metadata, created_by, created_at, updated_at").order("created_at", { ascending: false }).limit(150),
    admin.from("api_keys").select("id, organization_id, name, key_prefix, scopes, status, last_used_at, expires_at, created_by, created_at").order("created_at", { ascending: false }).limit(150),
  ]);
  const connections = rows(connectionsResult.data as IntegrationConnectionRow[] | null);
  const keys = rows(keysResult.data as ApiKeyRow[] | null);
  const orgMap = await getOrganizationMap(unique([...connections.map((row) => row.organization_id), ...keys.map((row) => row.organization_id)]));
  const profileMap = await getProfileMap(unique([...connections.map((row) => row.created_by), ...keys.map((row) => row.created_by)]));
  return {
    connections: connections.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.created_by ? profileMap.get(row.created_by) : undefined })),
    apiKeys: keys.map((row) => ({ row, organization: orgMap.get(row.organization_id), actor: row.created_by ? profileMap.get(row.created_by) : undefined })),
  };
}
