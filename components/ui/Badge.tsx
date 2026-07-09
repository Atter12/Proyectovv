import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "info" | "premium" | "danger" | "neutral" | "purple";
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-[#EAF4FF] text-[#178BFF]",
  neutral: "bg-slate-100 text-slate-600",
  purple: "bg-violet-50 text-violet-700",
  premium: "bg-[#EAF4FF] text-[#178BFF]",
};

export function Badge({ className, variant = "default", tone, ...props }: BadgeProps) {
  const resolvedVariant = tone ?? variant;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md px-2 text-[0.6875rem] font-medium",
        variantClasses[resolvedVariant],
        className,
      )}
      {...props}
    />
  );
}
