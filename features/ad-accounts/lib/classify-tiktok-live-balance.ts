import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";

export type TikTokLiveBalanceKind = "cash" | "budget_cupo" | "unknown";

type LiveBalanceMetric = Pick<
  AdAccountLiveMetricsClient,
  "paymentPortfolioType" | "showBudgetLimit" | "balanceUsd"
> | null | undefined;

/**
 * BM 200 NON_SHARED = cash real.
 * BM 10/30 SHARED (+ showBudgetLimit) = cupo de presupuesto, no plata del cliente.
 */
export function classifyTikTokLiveBalance(
  metric: LiveBalanceMetric,
): TikTokLiveBalanceKind {
  if (!metric) return "unknown";
  const portfolio = String(metric.paymentPortfolioType ?? "")
    .trim()
    .toUpperCase();
  if (portfolio === "NON_SHARED") return "cash";
  if (portfolio === "SHARED") return "budget_cupo";
  if (metric.showBudgetLimit) return "budget_cupo";
  return "unknown";
}

/** Cash real o desconocido con saldo (no ocultar BM200 si falta portfolio). */
export function isTikTokCashLikeBalance(metric: LiveBalanceMetric): boolean {
  const kind = classifyTikTokLiveBalance(metric);
  return kind === "cash" || kind === "unknown";
}

export function isTikTokBudgetCupoBalance(metric: LiveBalanceMetric): boolean {
  return classifyTikTokLiveBalance(metric) === "budget_cupo";
}

export function tikTokLiveBalanceLabel(
  metric: LiveBalanceMetric,
  opts?: { agencyBmFunding?: boolean },
): string {
  const kind = classifyTikTokLiveBalance(metric);
  if (kind === "budget_cupo") return "Cupo presupuesto";
  if (opts?.agencyBmFunding && kind === "unknown") return "Cupo TikTok";
  return "Saldo TikTok";
}
