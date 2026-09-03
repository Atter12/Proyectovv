/**
 * Saldo gastable alineado a TikTok Ads Manager.
 * - NON_SHARED (BM200): cash real de la cuenta.
 * - SHARED (BM10/30): cupo = presupuesto − gastado (NO usar account_balance:
 *   eso es la línea de crédito del BM, no plata del cliente).
 */

function parseUsd(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function pickBalanceUsd(row: Record<string, unknown>): number | null {
  return (
    parseUsd(row.valid_cash_balance) ??
    parseUsd(row.cash_balance) ??
    parseUsd(row.valid_account_balance) ??
    parseUsd(row.account_balance) ??
    parseUsd(row.balance) ??
    parseUsd(row.available_balance)
  );
}

export function pickSpendableBudgetUsd(
  row: Record<string, unknown>,
): number | null {
  const portfolio = String(row.payment_portfolio_type ?? "")
    .trim()
    .toUpperCase();
  const cash =
    parseUsd(row.valid_cash_balance) ?? parseUsd(row.cash_balance);
  const budget = parseUsd(row.budget);
  const cost = parseUsd(row.budget_cost);

  if (portfolio === "NON_SHARED") {
    if (cash != null) return cash;
    return (
      parseUsd(row.valid_account_balance) ??
      parseUsd(row.account_balance) ??
      null
    );
  }

  if (budget != null && cost != null) {
    const headroom = Math.max(0, Math.round((budget - cost) * 100) / 100);
    if (headroom <= 0 && cash != null && cash > 0 && budget === 0) {
      return cash;
    }
    return headroom;
  }

  if (cash != null && cash > 0) return cash;
  if (portfolio === "SHARED") return null;
  return pickBalanceUsd(row);
}

/** Detalle de tope de gasto (Manager: presupuesto de cuenta SHARED). */
export type AdvertiserBudgetLimitSnapshot = {
  paymentPortfolioType: string | null;
  budgetMode: string | null;
  budgetUsd: number | null;
  budgetCostUsd: number | null;
  /** BM SHARED / presupuesto: mostrar “Límite · usado”. BM200 cash: no. */
  showBudgetLimit: boolean;
  isUnlimited: boolean;
};

export function pickBudgetLimitSnapshot(
  row: Record<string, unknown>,
): AdvertiserBudgetLimitSnapshot {
  const portfolioRaw = String(row.payment_portfolio_type ?? "")
    .trim()
    .toUpperCase();
  const portfolio = portfolioRaw || null;
  const budgetModeRaw = String(row.budget_mode ?? "").trim().toUpperCase();
  const budgetMode = budgetModeRaw || null;
  const budgetUsd = parseUsd(row.budget);
  const budgetCostUsd = parseUsd(row.budget_cost);
  const isUnlimited = budgetMode === "UNLIMITED";
  // Solo BM SHARED (10/30): el tope es el presupuesto de cuenta.
  // BM200 (NON_SHARED): el cash ya es el tope; no mostrar “Límite”.
  const showBudgetLimit = portfolio === "SHARED";

  return {
    paymentPortfolioType: portfolio,
    budgetMode,
    budgetUsd,
    budgetCostUsd,
    showBudgetLimit,
    isUnlimited,
  };
}

export function spendableUsdFromFinanceSnapshot(input: {
  paymentPortfolioType: string | null;
  cashBalance: number | null;
  validCashBalance?: number | null;
  budget: number;
  budgetCost: number;
  accountBalance: number | null;
  budgetMode?: string | null;
  /** Transferencias: presupuesto ilimitado SHARED no se puede bajar con seguridad. */
  forTransfer?: boolean;
}): number | null {
  const portfolio = String(input.paymentPortfolioType ?? "")
    .trim()
    .toUpperCase();
  const mode = String(input.budgetMode ?? "").trim().toUpperCase();

  if (input.forTransfer && mode === "UNLIMITED" && portfolio !== "NON_SHARED") {
    return 0;
  }

  return pickSpendableBudgetUsd({
    payment_portfolio_type: input.paymentPortfolioType,
    valid_cash_balance: input.validCashBalance,
    cash_balance: input.cashBalance,
    budget: input.budget,
    budget_cost: input.budgetCost,
    account_balance: input.accountBalance,
  });
}

export function usdToCents(usd: number | null | undefined): number {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return 0;
  return Math.max(0, Math.round(usd * 100));
}
