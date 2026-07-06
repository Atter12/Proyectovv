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
  default:
    "border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)] ring-1 ring-black/[0.02]",
  soft:
    "border-white/70 bg-white/78 shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl",
  premium:
    "border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] shadow-[var(--shadow-card)] ring-1 ring-white/80 backdrop-blur-xl",
  dark:
    "border-white/10 bg-slate-950/80 text-white shadow-2xl shadow-slate-950/30 ring-1 ring-white/10 backdrop-blur-xl",
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
        "relative overflow-hidden rounded-[1.35rem] border",
        toneClasses[tone],
        elevated &&
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]",
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {tone === "premium" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
        />
      ) : null}
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 flex flex-col gap-1.5", className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight text-slate-950",
        className,
      )}
      {...props}
    />
  );
}
