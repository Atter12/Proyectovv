import { formatMoney } from "@/lib/format-money";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";

/** Línea chica: tope de presupuesto SHARED (Manager). */
export function formatTikTokBudgetLimitLine(
  metric: Pick<
    AdAccountLiveMetricsClient,
    | "showBudgetLimit"
    | "isUnlimitedBudget"
    | "budgetUsd"
    | "budgetCostUsd"
  > | null | undefined,
): string | null {
  if (!metric?.showBudgetLimit) return null;
  if (metric.isUnlimitedBudget) return "Límite ilimitado";
  if (metric.budgetUsd == null) return null;
  const used = metric.budgetCostUsd ?? 0;
  return `Límite ${formatMoney(metric.budgetUsd)} · usado ${formatMoney(used)}`;
}
