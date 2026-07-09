import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "info" | "premium" | "danger" | "neutral" | "purple";
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[#f2f7f9] text-[#3d5a68]",
  success: "bg-[#edf8f3] text-[#1a7560]",
  warning: "bg-[#faf5eb] text-[#8a6d2e]",
  danger: "bg-[#faf0f2] text-[#9a4056]",
  info: "bg-[#f0f7fa] text-[#3d8fa8]",
  neutral: "bg-[#f4f7f9] text-[#5d7280]",
  purple: "bg-violet-50/90 text-violet-700/90",
  premium: "bg-[linear-gradient(135deg,rgba(14,116,144,0.08),rgba(125,211,176,0.14))] text-[#3d8fa8]",
};

export function Badge({ className, variant = "default", tone, ...props }: BadgeProps) {
  const resolvedVariant = tone ?? variant;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[0.6875rem] font-semibold tracking-[0.02em]",
        variantClasses[resolvedVariant],
        className,
      )}
      {...props}
    />
  );
}
