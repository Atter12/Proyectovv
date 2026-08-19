import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsSummaryCardsProps {
  summary: AdAccountsSummary;
}

export function AdAccountsSummaryCards({ summary }: AdAccountsSummaryCardsProps) {
  const items = [
    {
      label: "Totales",
      value: formatNumber(summary.totalAccounts),
      hint: "Mapeadas en Hecom",
      accent: "bg-[#8a8178]",
      valueClass: "text-[#1a1612]",
    },
    {
      label: "Activas",
      value: formatNumber(summary.activeAccounts),
      hint: "Listas para gastar",
      accent: "bg-[#2f7a57]",
      valueClass: "text-[#1f5c40]",
    },
    {
      label: "Saldo asignado",
      value: formatMoney(summary.assignedBalance),
      hint: "Disponible en cuentas",
      accent: "bg-[#c45a18]",
      valueClass: "text-[#1a1612]",
    },
    {
      label: "Suspendidas",
      value: formatNumber(summary.disabledAccounts ?? 0),
      hint: "Baneadas o castigadas en TikTok",
      accent: "bg-[#c53030]",
      valueClass:
        (summary.disabledAccounts ?? 0) > 0
          ? "text-[#9b2c2c]"
          : "text-[#1a1612]",
    },
  ];

  return (
    <section
      aria-label="Resumen de cuentas"
      className="overflow-hidden rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]"
    >
      <div className="grid divide-y divide-[rgb(20_18_16_/_0.06)] sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.label}
            className={`relative px-4 py-4 sm:px-5 ${
              index % 2 === 0 ? "sm:border-r sm:border-[rgb(20_18_16_/_0.06)]" : ""
            } ${
              index < 2 ? "sm:border-b sm:border-[rgb(20_18_16_/_0.06)] xl:border-b-0" : ""
            } ${
              index < items.length - 1 ? "xl:border-r xl:border-[rgb(20_18_16_/_0.06)]" : ""
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
              className={`mt-1.5 truncate pl-2 text-[1.25rem] font-medium tracking-[-0.01em] tabular-nums sm:text-[1.35rem] ${item.valueClass}`}
            >
              {item.value}
            </p>
            <p className="mt-1 pl-2 text-[12px] leading-5 text-[#8a8178]">
              {item.hint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
