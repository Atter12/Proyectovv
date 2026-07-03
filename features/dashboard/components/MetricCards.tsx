import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import type { DashboardMetrics } from "@/mocks/dashboard.mock";

interface MetricCardsProps {
  metrics: DashboardMetrics;
}

export function MetricCards({ metrics }: MetricCardsProps) {
  const items = [
    {
      label: "Gasto de hoy",
      value: formatMoney(metrics.todaySpend),
    },
    {
      label: "Ganancia por recomendación",
      value: `${formatMoney(metrics.referralEarnings)} / ${formatNumber(metrics.referralMembers)} miembro`,
    },
    {
      label: "Cuentas publicitarias totales",
      value: formatNumber(metrics.totalAdAccounts),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label}>
          <p className="text-xs font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
