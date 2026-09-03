import { formatMoney } from "@/lib/format-money";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";

/** Línea chica: tope de presupuesto SHARED (Manager). No es “gasto de más”. */
export function formatTikTokBudgetLimitLine(
  metric: Pick<
    AdAccountLiveMetricsClient,
    | "showBudgetLimit"
    | "isUnlimitedBudget"
    | "budgetUsd"
    | "budgetCostUsd"
    | "balanceUsd"
  > | null | undefined,
): string | null {
  if (!metric?.showBudgetLimit) return null;
  if (metric.isUnlimitedBudget) return "Presupuesto ilimitado";
  if (metric.budgetUsd == null) return null;
  const used = metric.budgetCostUsd ?? 0;
  const left =
    metric.balanceUsd != null
      ? metric.balanceUsd
      : Math.max(0, Math.round((metric.budgetUsd - used) * 100) / 100);
  // Queda + gastado = tope. El grande arriba es “queda”.
  return `Presupuesto ${formatMoney(metric.budgetUsd)} · gastado ${formatMoney(used)} · queda ${formatMoney(left)}`;
}
