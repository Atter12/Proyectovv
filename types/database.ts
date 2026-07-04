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

export interface DbWalletRow {
  id: string;
  organization_id: string;
  name: string;
  currency: string;
  balance_cents: number;
  status: string;
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
