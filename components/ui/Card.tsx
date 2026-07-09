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
  default: "bg-white shadow-sm",
  soft: "bg-white shadow-sm",
  premium: "bg-white shadow-[var(--admin-shadow-2)]",
  dark: "bg-slate-950 text-white shadow-[var(--admin-shadow-3)]",
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
        "relative overflow-hidden border border-slate-200",
        radiusClass,
        toneClasses[tone],
        elevated &&
          "transition-[box-shadow,transform,border-color] duration-150 ease-out hover:-translate-y-px hover:border-slate-300 hover:shadow-md",
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
  return <h3 className={cn("text-base font-semibold tracking-tight text-slate-950", className)} {...props} />;
}
