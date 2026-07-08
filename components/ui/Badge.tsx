import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "info" | "premium" | "danger" | "neutral" | "purple";
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/70",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
  danger: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70",
  info: "bg-[#4056ff]/8 text-[#4056ff] ring-1 ring-[#4056ff]/15",
  neutral: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/70",
  purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/70",
  premium:
    "bg-[linear-gradient(135deg,rgba(64,86,255,0.12),rgba(124,58,237,0.10))] text-[#3340d6] ring-1 ring-[#4056ff]/15 shadow-sm",
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
