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

/**
 * Resumen de pagos — grilla clara (sin banda negra “Holistic en números”).
 */
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
      accent: true as boolean,
    },
    {
      label: "Pasarela activa",
      value: activeGateway.name,
      hint: hideWalletAsFunding ? "Solo camino cliente" : "Método seleccionado",
      accent: false,
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
      accent: false,
    },
  ];

  return (
    <section aria-label="Resumen de pagos" className="space-y-3">
      <div>
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#ff781f]">
          Resumen
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-[#5c564e]">
          Pulso de cartera y asignación
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="relative overflow-hidden rounded-[1rem] border border-[#ece7e0] bg-white px-4 py-3.5 shadow-[0_10px_28px_-20px_rgb(28_25_23_/_0.16)]"
          >
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,#ff781f,#ffa12c,transparent)] opacity-90"
            />
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#8a8177]">
              {item.label}
            </p>
            <p
              className={`mt-1.5 truncate text-[1.15rem] font-bold tracking-[-0.03em] tabular-nums ${
                item.accent ? "text-[#ff781f]" : "text-[#1c1917]"
              }`}
            >
              {item.value}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[#5c564e]">
              {item.hint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
