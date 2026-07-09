import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
  elevated?: boolean;
  tone?: "default" | "soft" | "premium" | "dark";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

const toneClasses = {
  default: "bg-[var(--admin-surface)] shadow-[var(--admin-shadow-1)]",
  soft: "bg-[var(--admin-surface)] shadow-[var(--admin-shadow-1)]",
  premium: "bg-[var(--admin-surface)] shadow-[var(--admin-shadow-2)]",
  dark: "bg-[var(--admin-surface-soft)] text-[var(--admin-text)] shadow-[var(--admin-shadow-3)]",
};

export function Card({
  className,
  padding = "md",
  elevated = false,
  tone = "default",
  children,
  ...props
}: CardProps) {
  const radiusClass = tone === "dark" ? "rounded-2xl" : "rounded-xl";

  return (
    <div
      className={cn(
        "relative overflow-hidden border border-[var(--admin-border)]",
        radiusClass,
        toneClasses[tone],
        elevated &&
          "transition-[box-shadow,transform,border-color] duration-150 ease-out hover:-translate-y-px hover:border-[var(--admin-border-strong)] hover:shadow-[var(--admin-shadow-2)]",
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-[var(--admin-text)]", className)} {...props} />;
}
