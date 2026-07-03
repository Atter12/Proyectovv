import { Card } from "@/components/ui/Card";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import type { PaymentGateway, PaymentOverview } from "@/types/payment";

interface PaymentOverviewStatsProps {
  wallet: PaymentOverview["wallet"];
  summary: PaymentOverview["summary"];
  activeGateway: PaymentGateway;
}

export function PaymentOverviewStats({
  wallet,
  summary,
  activeGateway,
}: PaymentOverviewStatsProps) {
  const items = [
    {
      label: "Saldo disponible",
      value: formatMoney(wallet.balance, wallet.currency),
      hint: "Cartera Default",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: "Pasarela activa",
      value: activeGateway.name,
      hint: "Método seleccionado",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
        </svg>
      ),
    },
    {
      label: "Cuentas listas",
      value: formatNumber(summary.accountsReadyForAllocation),
      hint: "Para asignación",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      label: "Reembolsos pendientes",
      value: formatNumber(summary.pendingRefunds),
      hint: "En procesamiento",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card
          key={item.label}
          padding="sm"
          className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4056ff]/10 text-[#4056ff]">
              {item.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#64748b]">
                {item.label}
              </p>
              <p className="mt-0.5 truncate text-lg font-bold text-[#0f172a]">
                {item.value}
              </p>
              <p className="mt-0.5 text-xs text-[#64748b]">{item.hint}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
