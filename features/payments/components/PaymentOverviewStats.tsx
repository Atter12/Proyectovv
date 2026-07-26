import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import type { PaymentGateway, PaymentPageCore } from "@/types/payment";

interface PaymentOverviewStatsProps {
  wallet: PaymentPageCore["wallet"];
  summary: PaymentPageCore["summary"];
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
      hint: "Cartera de la organización",
      accent: "bg-[#c45a18]",
      tone: "text-[#1a1612]",
    },
    {
      label: "Pasarela activa",
      value: activeGateway.name,
      hint: "Método seleccionado",
      accent: "bg-[#8a8178]",
      tone: "text-[#1a1612]",
    },
    {
      label: "Cuentas listas",
      value: formatNumber(summary.accountsReadyForAllocation),
      hint: "Para asignación",
      accent: "bg-[#2f7a57]",
      tone: "text-[#1f5c40]",
    },
    {
      label: "Reembolsos",
      value: formatNumber(summary.pendingRefunds),
      hint: "Pendientes",
      accent: "bg-[#b45309]",
      tone: "text-[#1a1612]",
    },
  ];

  return (
    <section
      aria-label="Resumen de pagos"
      className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={`relative px-4 py-3.5 sm:px-5 ${
              index % 2 === 0 ? "sm:border-r sm:border-[rgb(20_18_16_/_0.06)]" : ""
            } ${
              index < 2
                ? "border-b border-[rgb(20_18_16_/_0.06)] xl:border-b-0"
                : ""
            } ${
              index < items.length - 1
                ? "xl:border-r xl:border-[rgb(20_18_16_/_0.06)]"
                : ""
            }`}
          >
            <span
              aria-hidden
              className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${item.accent}`}
            />
            <p className="pl-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
              {item.label}
            </p>
            <p
              className={`mt-1 truncate pl-2 text-[1.15rem] font-medium tracking-[-0.015em] tabular-nums sm:text-[1.25rem] ${item.tone}`}
            >
              {item.value}
            </p>
            <p className="mt-0.5 pl-2 text-[11px] text-[#8a8178]">{item.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
