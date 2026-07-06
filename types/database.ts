import type { PaymentGatewayId } from "@/types/payment";

export type DbPaymentProvider = PaymentGatewayId;

export type DbPaymentStatus =
  | "created"
  | "requires_payment"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type DbTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

export type DbWalletTransactionType =
  | "deposit"
  | "withdrawal"
  | "allocation"
  | "refund"
  | "adjustment";

export type DbAdPlatform =
  | "meta"
  | "google"
  | "tiktok"
  | "linkedin"
  | "other";

export type DbAdAccountStatus =
  | "active"
  | "pending"
  | "disabled"
  | "review";

export type DbReferralStatus =
  | "pending"
  | "active"
  | "paused"
  | "closed"
  | "converted";

export type DbCreativeAnalysisStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type DbLedgerJournalStatus = "draft" | "posted" | "reversed" | "void";

export interface DbWalletRow {
  id: string;
  organization_id: string;
  name: string;
  currency: string;
  balance_cents: number;
  reserved_balance_cents?: number;
  status: string;
}

export interface DbWalletLedgerBalanceRow {
  wallet_id: string;
  organization_id: string;
  currency: string;
  available_balance_cents: number;
  reserved_balance_cents: number;
  calculated_at?: string;
}

export interface DbAdAccountLedgerBalanceRow {
  ad_account_id: string;
  organization_id: string;
  wallet_id: string;
  currency: string;
  available_balance_cents: number;
  reserved_balance_cents: number;
  lifetime_spend_cents: number;
  calculated_at?: string;
}

export interface DbLedgerJournalRow {
  id: string;
  organization_id: string;
  wallet_id: string;
  journal_type: string;
  status: DbLedgerJournalStatus;
  amount_cents: number;
  currency: string;
  source_table: string | null;
  source_id: string | null;
  provider: string | null;
  provider_reference: string | null;
  idempotency_key: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DbWalletTransactionRow {
  id: string;
  wallet_id: string;
  organization_id: string;
  type: DbWalletTransactionType;
  amount_cents: number;
  currency: string;
  status: DbTransactionStatus;
  balance_after_cents: number | null;
  description: string | null;
  external_reference: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface DbPaymentIntentRow {
  id: string;
  organization_id: string;
  wallet_id: string;
  amount_cents: number;
  currency: string;
  provider: DbPaymentProvider;
  provider_reference: string | null;
  status: DbPaymentStatus;
  idempotency_key: string | null;
  checkout_url: string | null;
  metadata: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbAdAccountRow {
  id: string;
  organization_id: string;
  name: string;
  platform: DbAdPlatform;
  external_account_id: string | null;
  status: DbAdAccountStatus;
  daily_budget_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface DbAdAccountBalanceRow {
  ad_account_id: string;
  organization_id: string;
  balance_cents: number;
  reserved_balance_cents?: number;
  currency: string;
}

export interface DbReferralCodeRow {
  id: string;
  organization_id: string;
  user_id: string;
  code: string;
  status: string;
}

export interface DbReferralRow {
  id: string;
  referral_code_id: string;
  referrer_user_id: string | null;
  referred_organization_id: string | null;
  status: DbReferralStatus;
  commission_rate: number;
  commission_amount_cents: number;
  created_at: string;
  converted_at: string | null;
}

export interface DbOrganizationWalletSummaryRow {
  organization_id: string;
  wallet_id: string;
  name: string;
  currency: string;
  balance_cents: number;
  status: string;
  last_deposit_at: string | null;
  pending_payment_intents: number;
}

export interface DbPaymentsPageSummaryRow extends DbOrganizationWalletSummaryRow {
  pending_refunds: number;
  accounts_ready_for_allocation: number;
}

export interface DbOrganizationDashboardCountsRow {
  organization_id: string;
  total_ad_accounts: number;
  total_campaigns: number;
  active_ad_accounts: number;
}

export interface DbOverviewPageSummaryRow {
  organization_id: string;
  wallet_id: string | null;
  wallet_name: string | null;
  wallet_currency: string | null;
  wallet_balance_cents: number | null;
  total_ad_accounts: number | null;
  total_campaigns: number | null;
  active_ad_accounts: number | null;
  spend_30d_cents: number | null;
  impressions_30d: number | null;
  clicks_30d: number | null;
  conversions_30d: number | null;
  revenue_30d_cents: number | null;
  today_spend_cents: number | null;
}

export interface DbAdAccountsPageSummaryRow {
  organization_id: string;
  total_accounts: number;
  active_accounts: number;
  pending_setup: number;
  assigned_balance_cents: number;
}

export interface DbIntegrationConnectionRow {
  id: string;
  organization_id: string;
  provider: string;
  name: string;
  status: "active" | "disabled" | "expired" | "error" | "revoked";
  external_account_id: string | null;
  encrypted_credentials: Record<string, unknown>;
  scopes: string[];
  last_synced_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
