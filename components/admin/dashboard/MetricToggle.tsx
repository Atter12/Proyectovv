"use client";

import { cn } from "@/lib/cn";

export type MetricToggleOption<T extends string> = {
  value: T;
  label: string;
  suggested?: boolean;
};

export function MetricToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: Array<MetricToggleOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              isActive
                ? "bg-[#178BFF] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
            aria-pressed={isActive}
          >
            {option.label}
            {option.suggested && !isActive ? (
              <span
                className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
