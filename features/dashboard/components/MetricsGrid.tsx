import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import type { DashboardMetrics } from "@/mocks/dashboard.mock";

interface MetricsGridProps {
  metrics: DashboardMetrics;
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const items = [
    {
      label: "Gasto de hoy",
      value: formatMoney(metrics.todaySpend),
      hint: "Sin campañas activas hoy",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
      status: "Sin actividad",
    },
    {
      label: "Ganancia por recomendación",
      value: `${formatMoney(metrics.referralEarnings)} / ${formatNumber(metrics.referralMembers)} miembro`,
      hint: "Comparte tu enlace para empezar",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
      status: "0 referidos",
    },
    {
      label: "Cuentas publicitarias totales",
      value: formatNumber(metrics.totalAdAccounts),
      hint: "Crea tu primera cuenta",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
      status: "Pendiente",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.label}
          className="min-w-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4056ff]/10 text-[#4056ff]">
              {item.icon}
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-[#64748b]">
              {item.status}
            </span>
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-[#64748b]">
            {item.label}
          </p>
          <p className="mt-1 truncate text-xl font-bold tracking-tight text-[#0f172a] sm:text-2xl">
            {item.value}
          </p>
          <p className="mt-1.5 text-xs text-[#64748b]">{item.hint}</p>
        </Card>
      ))}
    </div>
  );
}
