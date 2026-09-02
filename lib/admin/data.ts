import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecord } from "@/lib/types/json";
import { VOUCHER_PAYMENT_PROVIDERS } from "@/types/payment";

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

export function getManualProof(metadata: unknown): {
  storagePath?: string;
  fileName?: string;
  publicUrl?: string;
  signedUrl?: string;
  uploadedAt?: string;
  notes?: string;
  mimeType?: string;
} | null {
  if (!isRecord(metadata)) return null;
  const proof = metadata.manual_proof;
  if (!isRecord(proof)) return null;
  const storagePath =
    typeof proof.path === "string"
      ? proof.path
      : typeof proof.storage_path === "string"
        ? proof.storage_path
        : undefined;
  return {
    storagePath,
    fileName: typeof proof.file_name === "string" ? proof.file_name : undefined,
    publicUrl: typeof proof.public_url === "string" ? proof.public_url : undefined,
    signedUrl: typeof proof.signed_url === "string" ? proof.signed_url : undefined,
    uploadedAt:
      typeof proof.submitted_at === "string"
        ? proof.submitted_at
        : typeof proof.uploaded_at === "string"
          ? proof.uploaded_at
          : undefined,
    notes: typeof proof.notes === "string" ? proof.notes : undefined,
    mimeType: typeof proof.mime_type === "string" ? proof.mime_type : undefined,
  };
}

export async function getOrganizationMap(ids: string[]): Promise<Map<string, OrganizationRow>> {
  if (ids.length === 0) return new Map();
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id, name, slug, legal_name, tax_id, website_url, logo_url, status, created_by, created_at, updated_at, metadata")
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

const PENDING_PAYMENT_STATUSES = ["created", "requires_payment", "processing"] as const;
const COMPLETED_PAYMENT_STATUS = "succeeded";

export interface PaymentFlowDayPoint {
  date: string;
  label: string;
  created: number;
  completed: number;
  pending: number;
  processedCents: number;
}

export interface OperationalQueuePoint {
  category: string;
  label: string;
  count: number;
  href: string;
}

export interface WalletExposurePoint {
  organizationId: string;
  organizationName: string;
  balanceCents: number;
  reservedCents: number;
  availableCents: number;
  currency: string;
}

export interface OverviewAnalyticsData {
  paymentFlow: PaymentFlowDayPoint[];
  walletExposure: WalletExposurePoint[];
  primaryCurrency: string;
  operationalProgress: OperationalMonthlyProgress;
}

export interface OperationalMonthlyProgress {
  total: number;
  emitted: number;
  completed: number;
  completionRate: number;
}

function getCurrentMonthStartUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function buildOperationalMonthlyProgress(emitted: number, completed: number): OperationalMonthlyProgress {
  const total = emitted + completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, emitted, completed, completionRate };
}

/**
 * Monthly operational throughput across the four admin queue domains.
 * Emitted = items created this month still pending/open/failed.
 * Completed = items resolved this month (succeeded payments, completed refunds,
 * closed tickets, processed webhooks).
 */
export async function getOperationalMonthlyProgress(): Promise<OperationalMonthlyProgress> {
  const admin = createAdminClient();
  const monthStart = getCurrentMonthStartUtcIso();

  const [
    paymentsEmitted,
    refundsEmitted,
    ticketsEmitted,
    webhooksEmitted,
    paymentsCompleted,
    refundsCompleted,
    ticketsCompleted,
    webhooksCompleted,
  ] = await Promise.all([
    admin
      .from("payment_intents")
      .select("*", { count: "exact", head: true })
      .in("provider", [...VOUCHER_PAYMENT_PROVIDERS])
      .gte("created_at", monthStart)
      .in("status", [...PENDING_PAYMENT_STATUSES]),
    admin
      .from("wallet_transactions")
      .select("*", { count: "exact", head: true })
      .eq("type", "refund")
      .eq("status", "pending")
      .gte("created_at", monthStart),
    admin
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "pending"])
      .gte("created_at", monthStart),
    admin
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", monthStart),
    admin
      .from("payment_intents")
      .select("*", { count: "exact", head: true })
      .in("provider", [...VOUCHER_PAYMENT_PROVIDERS])
      .eq("status", COMPLETED_PAYMENT_STATUS)
      .gte("succeeded_at", monthStart),
    admin
      .from("wallet_transactions")
      .select("*", { count: "exact", head: true })
      .eq("type", "refund")
      .eq("status", "completed")
      .gte("created_at", monthStart),
    admin
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .in("status", ["resolved", "closed"])
      .gte("closed_at", monthStart),
    admin
      .from("webhook_events")
      .select("*", { count: "exact", head: true })
      .eq("status", "processed")
      .gte("processed_at", monthStart),
  ]);

  const emitted =
    (paymentsEmitted.count ?? 0) +
    (refundsEmitted.count ?? 0) +
    (ticketsEmitted.count ?? 0) +
    (webhooksEmitted.count ?? 0);
  const completed =
    (paymentsCompleted.count ?? 0) +
    (refundsCompleted.count ?? 0) +
    (ticketsCompleted.count ?? 0) +
    (webhooksCompleted.count ?? 0);

  return buildOperationalMonthlyProgress(emitted, completed);
}

function toUtcDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildLast30UtcDateKeys(): string[] {
  const days: string[] = [];
  const anchor = new Date();
  anchor.setUTCHours(0, 0, 0, 0);
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(anchor);
    day.setUTCDate(anchor.getUTCDate() - offset);
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

function formatChartDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(date);
}

export function buildOperationalQueueFromCounts(counts: {
  pendingPayments: number;
  pendingRefunds: number;
  openTickets: number;
  failedWebhooks: number;
}): OperationalQueuePoint[] {
  return [
    { category: "payments", label: "Pagos pendientes", count: counts.pendingPayments, href: "/admin/payments" },
    { category: "refunds", label: "Reembolsos pendientes", count: counts.pendingRefunds, href: "/admin/refunds" },
    { category: "tickets", label: "Tickets abiertos", count: counts.openTickets, href: "/admin/support" },
    { category: "webhooks", label: "Webhooks fallidos", count: counts.failedWebhooks, href: "/admin/webhooks" },
  ];
}

export async function getOverviewAnalyticsData(): Promise<OverviewAnalyticsData> {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 29);
  const sinceIso = since.toISOString();

  const [paymentsResult, walletsResult, operationalProgress] = await Promise.all([
    admin
      .from("payment_intents")
      .select("created_at, status, amount_cents")
      .gte("created_at", sinceIso),
    admin
      .from("wallets")
      .select("organization_id, balance_cents, reserved_balance_cents, currency, status")
      .eq("status", "active"),
    getOperationalMonthlyProgress(),
  ]);

  const dayKeys = buildLast30UtcDateKeys();
  const flowByDay = new Map<string, { created: number; completed: number; pending: number; processedCents: number }>();
  for (const day of dayKeys) {
    flowByDay.set(day, { created: 0, completed: 0, pending: 0, processedCents: 0 });
  }

  for (const payment of rows(paymentsResult.data as Array<{ created_at: string; status: string; amount_cents: number }> | null)) {
    const day = toUtcDateKey(payment.created_at);
    const bucket = flowByDay.get(day);
    if (!bucket) continue;
    bucket.created += 1;
    if (payment.status === COMPLETED_PAYMENT_STATUS) {
      bucket.completed += 1;
      bucket.processedCents += Number(payment.amount_cents ?? 0);
    } else if ((PENDING_PAYMENT_STATUSES as readonly string[]).includes(payment.status)) {
      bucket.pending += 1;
    }
  }

  const paymentFlow: PaymentFlowDayPoint[] = dayKeys.map((date) => {
    const bucket = flowByDay.get(date) ?? { created: 0, completed: 0, pending: 0, processedCents: 0 };
    return {
      date,
      label: formatChartDayLabel(date),
      created: bucket.created,
      completed: bucket.completed,
      pending: bucket.pending,
      processedCents: bucket.processedCents,
    };
  });

  const walletRows = rows(walletsResult.data as Array<{
    organization_id: string;
    balance_cents: number;
    reserved_balance_cents: number | null;
    currency: string;
  }> | null);

  const exposureByOrg = new Map<string, { balanceCents: number; reservedCents: number; currency: string }>();
  for (const wallet of walletRows) {
    const current = exposureByOrg.get(wallet.organization_id) ?? {
      balanceCents: 0,
      reservedCents: 0,
      currency: wallet.currency,
    };
    current.balanceCents += Number(wallet.balance_cents ?? 0);
    current.reservedCents += Number(wallet.reserved_balance_cents ?? 0);
    exposureByOrg.set(wallet.organization_id, current);
  }

  const orgMap = await getOrganizationMap(Array.from(exposureByOrg.keys()));
  const walletExposure: WalletExposurePoint[] = Array.from(exposureByOrg.entries())
    .map(([organizationId, totals]) => ({
      organizationId,
      organizationName: orgMap.get(organizationId)?.name ?? `${organizationId.slice(0, 8)}…`,
      balanceCents: totals.balanceCents,
      reservedCents: totals.reservedCents,
      availableCents: Math.max(0, totals.balanceCents - totals.reservedCents),
      currency: totals.currency,
    }))
    .filter((item) => item.availableCents + item.reservedCents > 0)
    .sort((left, right) => right.availableCents + right.reservedCents - (left.availableCents + left.reservedCents))
    .slice(0, 10);

  return {
    paymentFlow,
    walletExposure,
    primaryCurrency: walletRows[0]?.currency ?? "USD",
    operationalProgress,
  };
}

export type AdminNavSignals = {
  "/admin/payments": number;
  "/admin/support": number;
  "/admin/webhooks": number;
};

export async function getAdminNavSignals(): Promise<AdminNavSignals> {
  const admin = createAdminClient();

  const [pendingPaymentsResult, openTicketsResult, failedWebhooksResult] = await Promise.all([
    admin
      .from("payment_intents")
      .select("*", { count: "exact", head: true })
      .in("provider", [...VOUCHER_PAYMENT_PROVIDERS])
      .in("status", [...PENDING_PAYMENT_STATUSES]),
    admin.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "pending"]),
    admin.from("webhook_events").select("*", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  return {
    "/admin/payments": pendingPaymentsResult.count ?? 0,
    "/admin/support": openTicketsResult.count ?? 0,
    "/admin/webhooks": failedWebhooksResult.count ?? 0,
  };
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
    admin.from("payment_intents").select("*", { count: "exact", head: true }).in("provider", [...VOUCHER_PAYMENT_PROVIDERS]).in("status", ["created", "requires_payment", "processing"]),
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
    .in("provider", [...VOUCHER_PAYMENT_PROVIDERS])
    .order("created_at", { ascending: false })
    .limit(120);
  if (filters.status && filters.status !== "all" && filters.status !== "pending_review") {
    query = query.eq("status", filters.status);
  }
  const { data } = await query;
  let payments = rows(data as PaymentIntentRow[] | null);

  if (filters.status === "pending_review") {
    payments = payments.filter((payment) => {
      if (payment.status === "succeeded" || payment.status === "failed" || payment.status === "cancelled") {
        return false;
      }
      const proof = getManualProof(payment.metadata);
      const review = isRecord(payment.metadata)
        ? payment.metadata.manual_review_status
        : null;
      return (
        review === "pending_review" ||
        (payment.status === "processing" && Boolean(proof))
      );
    });
  }

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

  // En revisión primero cuando se listan todos
  if (!filters.status || filters.status === "all") {
    payments = [...payments].sort((a, b) => {
      const aPending =
        a.status === "processing" ||
        (isRecord(a.metadata) && a.metadata.manual_review_status === "pending_review");
      const bPending =
        b.status === "processing" ||
        (isRecord(b.metadata) && b.metadata.manual_review_status === "pending_review");
      if (aPending === bPending) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return aPending ? -1 : 1;
    });
  }

  const { signPaymentProofUrl } = await import(
    "@/lib/payments/review-manual-payment.server"
  );

  return Promise.all(
    payments.map(async (row) => {
      const proof = getManualProof(row.metadata);
      const signedUrl = proof?.storagePath
        ? await signPaymentProofUrl(proof.storagePath)
        : proof?.signedUrl ?? null;
      return {
        row,
        organization: orgMap.get(row.organization_id),
        actor: row.created_by ? profileMap.get(row.created_by) : undefined,
        wallet: walletMap.get(row.wallet_id),
        proof: proof
          ? { ...proof, signedUrl: signedUrl ?? proof.signedUrl }
          : null,
      };
    }),
  );
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

  const proof = getManualProof(data.metadata);
  const { signPaymentProofUrl } = await import(
    "@/lib/payments/review-manual-payment.server"
  );
  const signedUrl = proof?.storagePath
    ? await signPaymentProofUrl(proof.storagePath)
    : proof?.signedUrl ?? null;

  return {
    row: data,
    organization: orgMap.get(data.organization_id),
    actor: data.created_by ? profileMap.get(data.created_by) : undefined,
    wallet: walletMap.get(data.wallet_id),
    proof: proof
      ? { ...proof, signedUrl: signedUrl ?? proof.signedUrl }
      : null,
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
    .select("id, name, slug, legal_name, tax_id, website_url, logo_url, status, created_by, created_at, updated_at, metadata")
    .order("created_at", { ascending: false })
    .limit(120);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) {
    throw new Error(`No se pudieron listar organizaciones: ${error.message}`);
  }
  let orgs = rows(data as OrganizationRow[] | null);
  const q = (filters.q ?? "").trim().toLowerCase();
  if (q) orgs = orgs.filter((org) => containsText([org.name, org.slug, org.legal_name, org.tax_id], q));

  const orgIds = orgs.map((org) => org.id);
  if (orgIds.length === 0) {
    return [];
  }

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
    .select("id, name, slug, legal_name, tax_id, website_url, logo_url, status, created_by, created_at, updated_at, metadata")
    .eq("id", id)
    .maybeSingle<OrganizationRow>();
  if (!org) return null;

  const [walletsResult, membershipsResult, adAccountsResult, paymentsResult, refundsResult, ticketsResult, journalsResult, referralsResult] = await Promise.all([
    admin.from("wallets").select("id, organization_id, name, currency, balance_cents, reserved_balance_cents, status, created_at, updated_at").eq("organization_id", id),
    admin.from("organization_memberships").select("id, organization_id, user_id, role, status, created_at, updated_at").eq("organization_id", id),
    admin.from("ad_accounts").select("id, organization_id, name, platform, external_account_id, external_business_id, external_account_name, status, daily_budget_cents, monthly_limit_cents, auto_recharge_enabled, recharge_threshold_cents, currency, timezone, metadata, created_by, created_at, updated_at, last_synced_at").eq("organization_id", id).order("created_at", { ascending: false }),
    admin.from("payment_intents").select("id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, metadata, created_by, created_at, updated_at, failure_reason, checkout_url, succeeded_at, canceled_at").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("wallet_transactions").select("id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, metadata, created_by, created_at, idempotency_key").eq("organization_id", id).eq("type", "refund").order("created_at", { ascending: false }).limit(20),
    admin.from("support_tickets").select("id, organization_id, requester_user_id, assigned_user_id, subject, status, priority, category, metadata, closed_at, created_at, updated_at").eq("organization_id", id).order("updated_at", { ascending: false, nullsFirst: false }).limit(20),
    admin.from("ledger_journals").select("id, organization_id, wallet_id, journal_type, status, amount_cents, currency, source_table, source_id, provider, provider_reference, idempotency_key, reversal_of_journal_id, reversed_by_journal_id, description, metadata, created_by, posted_at, created_at").eq("organization_id", id).order("created_at", { ascending: false }).limit(20),
    admin.from("referrals").select("id, referral_code_id, referrer_user_id, referred_organization_id, status, commission_rate, commission_amount_cents, created_at, converted_at, approved_at, paid_at, wallet_transaction_id, metadata").or(`referred_organization_id.eq.${id}`).order("created_at", { ascending: false }).limit(20),
  ]);

  const memberships = rows(membershipsResult.data as Array<{ id: string; organization_id: string; user_id: string; role: string; status: string; created_at: string; updated_at?: string | null }> | null);
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
    .select("id, organization_id, user_id, role, status, created_at")
    .in("user_id", userIds);
  const memberships = rows(membershipsData as Array<{ id: string; organization_id: string; user_id: string; role: string; status: string; created_at: string }> | null);
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

export interface ClientListItem {
  organization: OrganizationRow;
  primaryContact: ProfileRow | null;
  walletBalanceCents: number;
  walletCurrency: string;
  adAccountCount: number;
  activeMemberCount: number;
  tiktokConnected: boolean;
}

export async function listClients(filters: { q?: string; status?: string } = {}): Promise<ClientListItem[]> {
  const organizations = await listOrganizations(filters);
  const admin = createAdminClient();
  const orgIds = organizations.map((item) => item.row.id);
  if (orgIds.length === 0) return [];

  const membershipsResult = await admin
    .from("organization_memberships")
    .select("id, organization_id, user_id, role, status, created_at")
    .in("organization_id", orgIds)
    .eq("status", "active");

  let connections: Array<{ organization_id: string; provider: string; status: string }> = [];
  try {
    const connectionsResult = await admin
      .from("integration_connections")
      .select("organization_id, provider, status")
      .in("organization_id", orgIds)
      .eq("provider", "tiktok");
    if (!connectionsResult.error) {
      connections = rows(
        connectionsResult.data as Array<{
          organization_id: string;
          provider: string;
          status: string;
        }> | null,
      );
    }
  } catch {
    connections = [];
  }

  const memberships = rows(
    membershipsResult.data as Array<{
      id: string;
      organization_id: string;
      user_id: string;
      role: string;
      status: string;
      created_at: string;
    }> | null,
  );
  const profileMap = await getProfileMap(unique(memberships.map((member) => member.user_id)));

  return organizations.map(({ row, wallets, adAccountCount, activeMembers }) => {
    const orgMemberships = memberships
      .filter((member) => member.organization_id === row.id)
      .sort((a, b) => {
        const roleScore = (role: string) => (role === "owner" ? 0 : role === "admin" ? 1 : 2);
        return roleScore(a.role) - roleScore(b.role);
      });
    const primary = orgMemberships[0] ? profileMap.get(orgMemberships[0].user_id) ?? null : null;
    const wallet = wallets[0];
    const tiktokConnected = connections.some(
      (connection) => connection.organization_id === row.id && connection.status === "active",
    );

    return {
      organization: row,
      primaryContact: primary,
      walletBalanceCents: wallet?.balance_cents ?? 0,
      walletCurrency: wallet?.currency ?? "USD",
      adAccountCount,
      activeMemberCount: activeMembers,
      tiktokConnected,
    };
  });
}

export async function listOrganizationEmailInvites(organizationId: string) {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from("organization_email_invites")
      .select("id, organization_id, email, role, status, created_at, accepted_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return [];
    return rows(
      data as Array<{
        id: string;
        organization_id: string;
        email: string;
        role: string;
        status: string;
        created_at: string;
        accepted_at: string | null;
      }> | null,
    );
  } catch {
    return [];
  }
}

export async function inviteClientEmail(input: {
  organizationId: string;
  email: string;
  role?: string;
  invitedBy?: string | null;
}) {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false as const, error: "Correo inválido." };
  }

  const { data, error } = await admin
    .from("organization_email_invites")
    .upsert(
      {
        organization_id: input.organizationId,
        email,
        role: input.role ?? "owner",
        status: "pending",
        invited_by: input.invitedBy ?? null,
        accepted_at: null,
        accepted_user_id: null,
      },
      { onConflict: "organization_id,email" },
    )
    .select("id, organization_id, email, role, status, created_at, accepted_at")
    .single();

  // Unique index is on (organization_id, lower(email)) — upsert onConflict may need exact constraint name.
  if (error) {
    // Fallback: revoke previous + insert, or update pending row.
    const { data: existing } = await admin
      .from("organization_email_invites")
      .select("id")
      .eq("organization_id", input.organizationId)
      .ilike("email", email)
      .maybeSingle<{ id: string }>();

    if (existing?.id) {
      const { data: updated, error: updateError } = await admin
        .from("organization_email_invites")
        .update({
          status: "pending",
          role: input.role ?? "owner",
          invited_by: input.invitedBy ?? null,
          accepted_at: null,
          accepted_user_id: null,
          email,
        })
        .eq("id", existing.id)
        .select("id, organization_id, email, role, status, created_at, accepted_at")
        .single();
      if (updateError || !updated) {
        return { ok: false as const, error: updateError?.message ?? error.message };
      }
      return { ok: true as const, invite: updated };
    }

    const { data: inserted, error: insertError } = await admin
      .from("organization_email_invites")
      .insert({
        organization_id: input.organizationId,
        email,
        role: input.role ?? "owner",
        status: "pending",
        invited_by: input.invitedBy ?? null,
      })
      .select("id, organization_id, email, role, status, created_at, accepted_at")
      .single();

    if (insertError || !inserted) {
      return { ok: false as const, error: insertError?.message ?? error.message };
    }
    return { ok: true as const, invite: inserted };
  }

  return { ok: true as const, invite: data };
}

export async function revokeClientEmailInvite(inviteId: string, organizationId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organization_email_invites")
    .update({ status: "revoked" })
    .eq("id", inviteId)
    .eq("organization_id", organizationId)
    .eq("status", "pending");

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

type ClientVistaSummaryRow = {
  wallet_balance_cents?: number | null;
  wallet_currency?: string | null;
  total_ad_accounts?: number | null;
  total_campaigns?: number | null;
  active_ad_accounts?: number | null;
  spend_30d_cents?: number | null;
  today_spend_cents?: number | null;
  impressions_30d?: number | null;
  clicks_30d?: number | null;
};

export async function getClientVista(organizationId: string) {
  const detail = await getOrganizationDetail(organizationId);
  if (!detail) return null;

  const admin = createAdminClient();

  let summary: ClientVistaSummaryRow | null = null;

  let campaigns: Array<{
    id: string;
    organization_id: string;
    ad_account_id: string | null;
    name: string;
    status: string;
    daily_budget_cents: number;
    currency: string;
    created_at: string;
    updated_at?: string | null;
  }> = [];

  let balanceByAccount = new Map<string, number>();
  let tiktok: {
    connected: boolean;
    status: string | null;
    lastSyncedAt: string | null;
    lastError: string | null;
  } = { connected: false, status: null, lastSyncedAt: null, lastError: null };

  try {
    const summaryResult = await admin
      .from("v_overview_page_summary")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!summaryResult.error && summaryResult.data) {
      summary = summaryResult.data as ClientVistaSummaryRow;
    }
  } catch {
    summary = null;
  }

  try {
    const campaignsResult = await admin
      .from("campaigns")
      .select(
        "id, organization_id, ad_account_id, name, status, daily_budget_cents, currency, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (!campaignsResult.error) {
      campaigns = rows(campaignsResult.data as typeof campaigns);
    }
  } catch {
    campaigns = [];
  }

  try {
    const balancesResult = await admin
      .from("v_ad_account_ledger_balances")
      .select("ad_account_id, organization_id, available_balance_cents, currency")
      .eq("organization_id", organizationId);
    if (!balancesResult.error) {
      const balances = rows(
        balancesResult.data as Array<{
          ad_account_id: string;
          available_balance_cents?: number | null;
        }> | null,
      );
      balanceByAccount = new Map(
        balances.map((row) => [row.ad_account_id, Number(row.available_balance_cents ?? 0)]),
      );
    }
  } catch {
    balanceByAccount = new Map();
  }

  try {
    const connectionResult = await admin
      .from("integration_connections")
      .select("id, provider, status, last_synced_at, updated_at, last_error")
      .eq("organization_id", organizationId)
      .eq("provider", "tiktok")
      .maybeSingle();
    if (!connectionResult.error && connectionResult.data) {
      tiktok = {
        connected: connectionResult.data.status === "active",
        status: connectionResult.data.status as string,
        lastSyncedAt: connectionResult.data.last_synced_at as string | null,
        lastError: connectionResult.data.last_error as string | null,
      };
    }
  } catch {
    // optional
  }

  const owners = detail.memberships
    .filter((item) => item.row.status === "active")
    .sort((a, b) => {
      const roleScore = (role: string) => (role === "owner" ? 0 : role === "admin" ? 1 : 2);
      return roleScore(a.row.role) - roleScore(b.row.role);
    });
  const primaryContact = owners[0]?.profile ?? detail.createdByProfile ?? null;

  return {
    organization: detail.row,
    primaryContact,
    members: detail.memberships,
    wallet: detail.wallets[0] ?? null,
    emailInvites: await listOrganizationEmailInvites(organizationId),
    summary: {
      walletBalanceCents: Number(summary?.wallet_balance_cents ?? detail.wallets[0]?.balance_cents ?? 0),
      currency: summary?.wallet_currency ?? detail.wallets[0]?.currency ?? "USD",
      totalAdAccounts: Number(summary?.total_ad_accounts ?? detail.adAccounts.length),
      activeAdAccounts: Number(
        summary?.active_ad_accounts ??
          detail.adAccounts.filter((account) => account.status === "active").length,
      ),
      totalCampaigns: Number(summary?.total_campaigns ?? campaigns.length),
      spend30dCents: Number(summary?.spend_30d_cents ?? 0),
      todaySpendCents: Number(summary?.today_spend_cents ?? 0),
      impressions30d: Number(summary?.impressions_30d ?? 0),
      clicks30d: Number(summary?.clicks_30d ?? 0),
    },
    tiktok,
    adAccounts: detail.adAccounts.map((account) => ({
      ...account,
      availableBalanceCents: balanceByAccount.get(account.id) ?? 0,
    })),
    campaigns,
    recentPayments: detail.payments.slice(0, 6),
  };
}
