import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import {
  getDefaultGatewayId,
  PAYMENT_GATEWAYS,
} from "@/lib/payments/gateway-config";
import { centsToAmount, mapWalletTransactionRow } from "@/lib/services/mappers";
import type { SessionUser } from "@/types/auth";
import type {
  DbAdAccountRow,
  DbAdAccountBalanceRow,
  DbPaymentsPageSummaryRow,
  DbWalletTransactionRow,
} from "@/types/database";
import type {
  PaymentAccountAllocation,
  PaymentOverview,
  TransactionHistoryItem,
} from "@/types/payment";

const TRANSACTION_PAGE_SIZE = 25;

export async function getPaymentOverview(
  session: SessionUser,
): Promise<PaymentOverview> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyPaymentOverview();
  }

  const supabase = await createClient();

  const [pageSummaryRes, adAccounts, adBalances, allocationTx, walletTx, refundTx] =
    await Promise.all([
      supabase
        .from("v_payments_page_summary")
        .select("*")
        .eq("organization_id", organizationId)
        .maybeSingle<DbPaymentsPageSummaryRow>(),
      supabase
        .from("ad_accounts")
        .select(
          "id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at",
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("ad_account_balances")
        .select("ad_account_id, organization_id, balance_cents, currency")
        .eq("organization_id", organizationId),
      supabase
        .from("wallet_transactions")
        .select(
          "id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, idempotency_key, created_at",
        )
        .eq("organization_id", organizationId)
        .eq("type", "allocation")
        .order("created_at", { ascending: false })
        .limit(TRANSACTION_PAGE_SIZE),
      supabase
        .from("wallet_transactions")
        .select(
          "id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, idempotency_key, created_at",
        )
        .eq("organization_id", organizationId)
        .in("type", ["deposit", "withdrawal", "adjustment"])
        .order("created_at", { ascending: false })
        .limit(TRANSACTION_PAGE_SIZE),
      supabase
        .from("wallet_transactions")
        .select(
          "id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, idempotency_key, created_at",
        )
        .eq("organization_id", organizationId)
        .eq("type", "refund")
        .order("created_at", { ascending: false })
        .limit(TRANSACTION_PAGE_SIZE),
    ]);

  let pageSummary = pageSummaryRes.data;
  if (pageSummaryRes.error || !pageSummary) {
    const { data: fallbackWallet } = await supabase
      .from("wallets")
      .select("id, organization_id, name, currency, balance_cents, status")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (fallbackWallet) {
      pageSummary = {
        organization_id: fallbackWallet.organization_id,
        wallet_id: fallbackWallet.id,
        name: fallbackWallet.name,
        currency: fallbackWallet.currency,
        balance_cents: fallbackWallet.balance_cents,
        status: fallbackWallet.status,
        last_deposit_at: null,
        pending_payment_intents: 0,
        pending_refunds: 0,
        accounts_ready_for_allocation: 0,
      };
    }
  }

  const accountRows = (adAccounts.data ?? []) as DbAdAccountRow[];
  const balanceRows = (adBalances.data ?? []) as DbAdAccountBalanceRow[];
  const balanceByAccount = new Map(
    balanceRows.map((row) => [row.ad_account_id, row.balance_cents]),
  );

  const accountTransactions = ((allocationTx.data ?? []) as DbWalletTransactionRow[]).map(
    mapWalletTransactionRow,
  );
  const walletTransactions = ((walletTx.data ?? []) as DbWalletTransactionRow[]).map(
    mapWalletTransactionRow,
  );
  const refunds = ((refundTx.data ?? []) as DbWalletTransactionRow[]).map(
    mapWalletTransactionRow,
  );

  const adAccountsForAllocation: PaymentAccountAllocation[] = accountRows.map(
    (account) => ({
      id: account.id,
      name: account.name,
      status: account.status,
      balance: centsToAmount(balanceByAccount.get(account.id) ?? 0),
      autoRecharge: false,
      thresholdInfo: "Sin auto-recarga configurada",
    }),
  );

  const preferredGateway = getDefaultGatewayId();

  return {
    wallet: {
      name: pageSummary?.name ?? siteConfig.walletName,
      balance: centsToAmount(pageSummary?.balance_cents ?? 0),
      currency: pageSummary?.currency ?? "USD",
      lastTopUp: pageSummary?.last_deposit_at ?? null,
      preferredGateway,
    },
    summary: {
      pendingRefunds: pageSummary?.pending_refunds ?? 0,
      accountsReadyForAllocation: pageSummary?.accounts_ready_for_allocation ?? 0,
    },
    selectedGateway: preferredGateway,
    gateways: PAYMENT_GATEWAYS,
    adAccountsForAllocation,
    accountTransactions,
    walletTransactions,
    refunds,
  };
}

function emptyPaymentOverview(): PaymentOverview {
  const preferredGateway = getDefaultGatewayId();
  return {
    wallet: {
      name: siteConfig.walletName,
      balance: 0,
      currency: "USD",
      lastTopUp: null,
      preferredGateway,
    },
    summary: { pendingRefunds: 0, accountsReadyForAllocation: 0 },
    selectedGateway: preferredGateway,
    gateways: PAYMENT_GATEWAYS,
    adAccountsForAllocation: [],
    accountTransactions: [],
    walletTransactions: [],
    refunds: [],
  };
}

export type { TransactionHistoryItem };
