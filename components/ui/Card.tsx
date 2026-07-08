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
  default: "border-[#d5e8ee] bg-white/[0.88] shadow-[var(--shadow-card)] ring-1 ring-white/70 backdrop-blur-xl",
  soft: "border-[#d5e8ee] bg-white/[0.76] shadow-[var(--shadow-card)] ring-1 ring-white/75 backdrop-blur-xl",
  premium: "border-[#bdd9e4] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,251,252,0.82))] shadow-[var(--shadow-card)] ring-1 ring-white/80 backdrop-blur-xl",
  dark: "border-white/10 bg-[#102f42] text-white shadow-2xl shadow-[#062235]/25 ring-1 ring-white/10 backdrop-blur-xl",
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
        "relative overflow-hidden rounded-[1.25rem] border",
        toneClasses[tone],
        elevated && "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
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
