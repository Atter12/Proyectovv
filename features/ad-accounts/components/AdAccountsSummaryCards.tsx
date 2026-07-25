import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsSummaryCardsProps {
  summary: AdAccountsSummary;
}

export function AdAccountsSummaryCards({ summary }: AdAccountsSummaryCardsProps) {
  const items = [
    {
      label: "Cuentas totales",
      value: formatNumber(summary.totalAccounts),
      hint: "Sin cuentas registradas",
    },
    {
      label: "Cuentas activas",
      value: formatNumber(summary.activeAccounts),
      hint: "Listas para publicar",
    },
    {
      label: "Saldo asignado",
      value: formatMoney(summary.assignedBalance),
      hint: "Presupuesto distribuido",
    },
    {
      label: "Pendientes",
      value: formatNumber(summary.pendingSetup),
      hint: "Requieren configuración",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="dashboard-kpi rounded-2xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b6b82]">
            {item.label}
          </p>
          <p className="mt-1 truncate font-display text-[1.35rem] font-medium tracking-tight text-[#0b1628] sm:text-[1.5rem]">
            {item.value}
          </p>
          <p className="mt-1 text-[13px] text-[#5b6b82]">{item.hint}</p>
        </div>
      ))}
    </div>
  );
}
