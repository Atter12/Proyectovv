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
  DbOrganizationWalletSummaryRow,
  DbWalletTransactionRow,
} from "@/types/database";
import type {
  PaymentAccountAllocation,
  PaymentOverview,
  TransactionHistoryItem,
} from "@/types/payment";

export async function getPaymentOverview(
  session: SessionUser,
): Promise<PaymentOverview> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyPaymentOverview();
  }

  const supabase = await createClient();

  const [walletSummaryRes, walletTx, adAccounts, adBalances] = await Promise.all([
    supabase
      .from("v_organization_wallet_summary")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle<DbOrganizationWalletSummaryRow>(),
    supabase
      .from("wallet_transactions")
      .select(
        "id, wallet_id, organization_id, type, amount_cents, currency, status, balance_after_cents, description, external_reference, idempotency_key, created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("ad_accounts")
      .select("id, organization_id, name, platform, external_account_id, status, daily_budget_cents, currency, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("ad_account_balances")
      .select("ad_account_id, organization_id, balance_cents, currency")
      .eq("organization_id", organizationId),
  ]);

  let walletRow = walletSummaryRes.data;
  if (walletSummaryRes.error || !walletRow) {
    const { data: fallbackWallet } = await supabase
      .from("wallets")
      .select("id, organization_id, name, currency, balance_cents, status")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle();
    if (fallbackWallet) {
      walletRow = {
        organization_id: fallbackWallet.organization_id,
        wallet_id: fallbackWallet.id,
        name: fallbackWallet.name,
        currency: fallbackWallet.currency,
        balance_cents: fallbackWallet.balance_cents,
        status: fallbackWallet.status,
        last_deposit_at: null,
        pending_payment_intents: 0,
      };
    }
  }

  const txRows = (walletTx.data ?? []) as DbWalletTransactionRow[];
  const accountRows = (adAccounts.data ?? []) as DbAdAccountRow[];
  const balanceRows = (adBalances.data ?? []) as DbAdAccountBalanceRow[];
  const balanceByAccount = new Map(
    balanceRows.map((row) => [row.ad_account_id, row.balance_cents]),
  );

  const walletTransactions = txRows
    .filter((row) => row.type !== "refund")
    .map(mapWalletTransactionRow);
  const refunds = txRows
    .filter((row) => row.type === "refund")
    .map(mapWalletTransactionRow);
  const accountTransactions = txRows
    .filter((row) => row.type === "allocation")
    .map(mapWalletTransactionRow);

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

  const pendingRefunds = txRows.filter(
    (row) => row.type === "refund" && row.status === "pending",
  ).length;

  const accountsReadyForAllocation = adAccountsForAllocation.filter(
    (account) => account.status === "active" && account.balance <= 0,
  ).length;

  const preferredGateway = getDefaultGatewayId();

  return {
    wallet: {
      name: walletRow?.name ?? siteConfig.walletName,
      balance: centsToAmount(walletRow?.balance_cents ?? 0),
      currency: walletRow?.currency ?? "USD",
      lastTopUp: walletRow?.last_deposit_at ?? null,
      preferredGateway,
    },
    summary: {
      pendingRefunds,
      accountsReadyForAllocation,
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
