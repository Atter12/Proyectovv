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
  const parts = formatTikTokBudgetLimitParts(metric);
  if (!parts) return null;
  if (parts.kind === "unlimited") return "Presupuesto ilimitado";
  return `Presupuesto ${parts.budget} · gastado ${parts.used} · queda ${parts.left}`;
}

export function formatTikTokBudgetLimitParts(
  metric: Pick<
    AdAccountLiveMetricsClient,
    | "showBudgetLimit"
    | "isUnlimitedBudget"
    | "budgetUsd"
    | "budgetCostUsd"
    | "balanceUsd"
  > | null | undefined,
):
  | { kind: "unlimited" }
  | { kind: "limited"; budget: string; used: string; left: string }
  | null {
  if (!metric?.showBudgetLimit) return null;
  if (metric.isUnlimitedBudget) return { kind: "unlimited" };
  if (metric.budgetUsd == null) return null;
  const used = metric.budgetCostUsd ?? 0;
  const left =
    metric.balanceUsd != null
      ? metric.balanceUsd
      : Math.max(0, Math.round((metric.budgetUsd - used) * 100) / 100);
  return {
    kind: "limited",
    budget: formatMoney(metric.budgetUsd),
    used: formatMoney(used),
    left: formatMoney(left),
  };
}
