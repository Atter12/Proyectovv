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
  default: "border border-[var(--admin-content-border)] bg-white/[0.94] shadow-[var(--admin-shadow-2)]",
  soft: "bg-white/[0.9] shadow-[var(--admin-shadow-2)]",
  premium:
    "border border-[var(--admin-content-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,252,253,0.9))] shadow-[var(--admin-shadow-2)]",
  dark: "border border-white/8 bg-[#102f42] text-white shadow-[var(--admin-shadow-3)]",
};

export function Card({
  className,
  padding = "md",
  elevated = false,
  tone = "default",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        toneClasses[tone],
        elevated &&
          "transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-[var(--admin-shadow-3)]",
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {tone === "premium" ? (
        <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
      ) : null}
      {children}
    </div>
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-base font-semibold tracking-tight text-[#061925]", className)} {...props} />;
}
