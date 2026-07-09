"use client";

import { MetricToggle } from "@/components/admin/dashboard/MetricToggle";
import type { PaymentFlowRange } from "@/lib/admin/chartUtils";

const RANGE_OPTIONS: Array<{ value: PaymentFlowRange; label: string }> = [
  { value: "7D", label: "7D" },
  { value: "15D", label: "15D" },
  { value: "30D", label: "30D" },
];

interface PaymentFlowRangeSelectorProps {
  value: PaymentFlowRange;
  suggestedRange: PaymentFlowRange;
  onChange: (range: PaymentFlowRange) => void;
}

export function PaymentFlowRangeSelector({ value, suggestedRange, onChange }: PaymentFlowRangeSelectorProps) {
  return (
    <MetricToggle
      value={value}
      onChange={onChange}
      ariaLabel="Rango del gráfico de pagos"
      options={RANGE_OPTIONS.map((option) => ({
        ...option,
        suggested: suggestedRange === option.value && suggestedRange !== "30D",
      }))}
    />
  );
}
