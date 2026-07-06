import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "luxury";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#4056ff] text-white shadow-lg shadow-[#4056ff]/20 hover:-translate-y-0.5 hover:bg-[#4d62ff] hover:shadow-[#4056ff]/30",
  secondary:
    "bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/20 hover:-translate-y-0.5 hover:bg-[#8b5cf6] hover:shadow-[#7c3aed]/30",
  outline:
    "border border-[var(--border-subtle)] bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
  luxury:
    "bg-[linear-gradient(135deg,#4056ff,#7c3aed)] text-white shadow-xl shadow-[#4056ff]/25 hover:-translate-y-0.5 hover:shadow-[#4056ff]/35",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-xl",
  md: "h-9 px-4 text-sm rounded-xl",
  lg: "h-11 px-6 text-sm rounded-2xl",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
