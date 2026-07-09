"use client";

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
    <div
      className="inline-flex rounded-full border border-[#cfe8ee] bg-white/70 p-0.5"
      role="group"
      aria-label="Rango del gráfico de pagos"
    >
      {RANGE_OPTIONS.map((option) => {
        const isActive = value === option.value;
        const isSuggested = suggestedRange === option.value && suggestedRange !== "30D";

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              "relative rounded-full px-2.5 py-1 text-[0.68rem] font-black tracking-wide transition",
              isActive
                ? "bg-[#0e7490] text-white shadow-sm"
                : "text-[#587080] hover:bg-[#effff7] hover:text-[#0e7490]",
            ].join(" ")}
            aria-pressed={isActive}
          >
            {option.label}
            {isSuggested && !isActive ? (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#59c493]" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
