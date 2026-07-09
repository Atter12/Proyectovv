import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "info" | "premium" | "danger" | "neutral" | "purple";
export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "purple";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--admin-badge-neutral-bg)] text-[var(--admin-badge-neutral-text)]",
  success: "bg-[var(--admin-badge-success-bg)] text-[var(--admin-badge-success-text)]",
  warning: "bg-[var(--admin-badge-warning-bg)] text-[var(--admin-badge-warning-text)]",
  danger: "bg-[var(--admin-badge-danger-bg)] text-[var(--admin-badge-danger-text)]",
  info: "bg-[var(--admin-badge-info-bg)] text-[var(--admin-badge-info-text)]",
  neutral: "bg-[var(--admin-badge-neutral-bg)] text-[var(--admin-badge-neutral-text)]",
  purple: "bg-[var(--admin-badge-purple-bg)] text-[var(--admin-badge-purple-text)]",
  premium: "bg-[var(--admin-badge-info-bg)] text-[var(--admin-badge-info-text)]",
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
