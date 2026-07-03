import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "No hay datos",
  description,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
      {...props}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <svg
          className="h-6 w-6 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25v3.75M14 11.25v3.75M4.5 7.5h15M9.75 7.5V5.625A1.125 1.125 0 0110.875 4.5h2.25A1.125 1.125 0 0114.25 5.625V7.5"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
}
