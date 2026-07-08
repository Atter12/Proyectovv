import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "info" | "premium" | "danger" | "neutral" | "purple";
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[#e8f6f8] text-[#16445a] ring-1 ring-[#cfe1e9]",
  success: "bg-[#effff7] text-[#047857] ring-1 ring-[#9af7c9]/70",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70",
  info: "bg-[#e8f6f8] text-[#0e7490] ring-1 ring-[#0e7490]/15",
  neutral: "bg-[#f1fafc] text-[#5d7280] ring-1 ring-[#d7e7ee]",
  purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/70",
  premium:
    "bg-[linear-gradient(135deg,rgba(14,116,144,0.12),rgba(154,247,201,0.24))] text-[#0e7490] ring-1 ring-[#0e7490]/15 shadow-sm",
};

export function Badge({ className, variant = "default", tone, ...props }: BadgeProps) {
  const resolvedVariant = tone ?? variant;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone ? "border py-1 text-[0.68rem] font-black uppercase tracking-[0.14em]" : null,
        variantClasses[resolvedVariant],
        className,
      )}
      {...props}
    />
  );
}
