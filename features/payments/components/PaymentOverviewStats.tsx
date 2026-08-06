"use client";

import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";
import type { PaymentGateway, PaymentPageCore } from "@/types/payment";

interface PaymentOverviewStatsProps {
  wallet: PaymentPageCore["wallet"];
  summary: PaymentPageCore["summary"];
  activeGateway: PaymentGateway;
  isStaff?: boolean;
}

export function PaymentOverviewStats({
  wallet,
  summary,
  activeGateway,
  isStaff = false,
}: PaymentOverviewStatsProps) {
  const { agencyBmFunding } = usePaymentsFundingMode();
  const hideWalletAsFunding = isStaff && agencyBmFunding;

  const items = [
    {
      label: hideWalletAsFunding ? "Cartera Holistic" : "Saldo disponible",
      value: formatMoney(wallet.balance, wallet.currency),
      hint: hideWalletAsFunding
        ? "No se usa en modo BM"
        : "Cartera de la organización",
      accent: hideWalletAsFunding,
    },
    {
      label: "Pasarela activa",
      value: activeGateway.name,
      hint: hideWalletAsFunding ? "Solo camino cliente" : "Método seleccionado",
    },
    {
      label: "Cuentas listas",
      value: formatNumber(summary.accountsReadyForAllocation),
      hint: "Para asignación",
      accent: true,
    },
    {
      label: "Reembolsos",
      value: formatNumber(summary.pendingRefunds),
      hint: "Pendientes",
    },
  ];

  return (
    <section
      aria-label="Resumen de pagos"
      className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.07)] bg-[#0f0e0c] text-white shadow-[0_18px_40px_rgb(15_14_12_/_0.18)]"
    >
      <div className="border-b border-white/10 px-5 py-4 sm:px-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4a]">
          Holistic en números
        </p>
        <p className="mt-1 text-[14px] font-medium text-white/70">
          Pulso de cartera y asignación
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="border-t border-white/10 px-5 py-5 sm:border-t-0 sm:border-l sm:border-white/10 sm:px-6 sm:first:border-l-0"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
              {item.label}
            </p>
            <p
              className={`mt-2 truncate font-display text-[1.15rem] font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.3rem] ${
                item.accent ? "text-[#ff9a4a]" : "text-white"
              }`}
            >
              {item.value}
            </p>
            <p className="mt-1 text-[11px] font-medium text-white/40">
              {item.hint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
