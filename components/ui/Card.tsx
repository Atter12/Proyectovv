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
  default: "bg-white/[0.96] shadow-[var(--admin-shadow-2)]",
  soft: "bg-white/[0.94] shadow-[var(--admin-shadow-2)]",
  premium:
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,252,253,0.94))] shadow-[var(--admin-shadow-2)]",
  dark: "bg-[#102f42] text-white shadow-[var(--admin-shadow-3)]",
};

export function Card({
  className,
  padding = "md",
  elevated = false,
  tone = "default",
  children,
  ...props
}: CardProps) {
  const radiusClass = tone === "dark" ? "rounded-[22px]" : "rounded-[18px]";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        radiusClass,
        toneClasses[tone],
        elevated &&
          "transition-[box-shadow,transform] duration-[180ms] ease-out hover:-translate-y-px hover:shadow-[var(--admin-shadow-3)]",
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
  return <h3 className={cn("text-base font-semibold tracking-tight text-[#061925]", className)} {...props} />;
}
