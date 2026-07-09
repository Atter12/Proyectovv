import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "info" | "premium" | "danger" | "neutral" | "purple";
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[#f3f6f8] text-[#4a6270]",
  success: "bg-[#f0f8f4] text-[#2d7a62]",
  warning: "bg-[#faf7f0] text-[#8a6d2e]",
  danger: "bg-[#faf4f5] text-[#9a4056]",
  info: "bg-[#f2f7fa] text-[#4a8fa3]",
  neutral: "bg-[#f5f7f9] text-[#5d7280]",
  purple: "bg-violet-50/80 text-violet-700/85",
  premium: "bg-[#f2f8f7] text-[#4a8fa3]",
};

export function Badge({ className, variant = "default", tone, ...props }: BadgeProps) {
  const resolvedVariant = tone ?? variant;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-[6px] px-2 text-[0.6875rem] font-medium tracking-[0.03em]",
        variantClasses[resolvedVariant],
        className,
      )}
      {...props}
    />
  );
}
