import { formatMoney } from "@/lib/format";
import type { PaymentFlowRangeTotals } from "@/lib/admin/chartUtils";

interface PaymentFlowSummaryProps {
  totals: PaymentFlowRangeTotals;
  currency: string;
}

export function PaymentFlowSummary({ totals, currency }: PaymentFlowSummaryProps) {
  const parts = [
    `${formatMoney(totals.processedCents, currency)} procesado`,
    `${totals.completed} completado${totals.completed === 1 ? "" : "s"}`,
    `${totals.pending} pendiente${totals.pending === 1 ? "" : "s"}`,
  ];

  if (totals.resolutionRate !== null) {
    parts.push(`${totals.resolutionRate}% resolución`);
  }

  return (
    <p className="text-xs font-bold leading-5 text-[#587080]">
      {parts.join(" · ")}
    </p>
  );
}
