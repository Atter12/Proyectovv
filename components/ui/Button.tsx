import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ComponentPropsWithoutRef, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "luxury" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: false;
};

type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild: true;
  children: ReactNode;
};

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
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:outline-rose-600",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-emerald-600",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-xl",
  md: "h-9 px-4 text-sm rounded-xl",
  lg: "h-11 px-6 text-sm rounded-2xl",
};

const baseClass =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function Button(props: NativeButtonProps | LinkButtonProps) {
  const { variant = "primary", size = "md", className } = props;
  const composed = cn(baseClass, variantClasses[variant], sizeClasses[size], className);

  if (props.asChild) {
    const { asChild: _asChild, variant: _variant, size: _size, className: _className, ...linkProps } = props;
    void _asChild;
    void _variant;
    void _size;
    void _className;
    return <Link className={composed} {...linkProps} />;
  }

  const { variant: _variant, size: _size, asChild: _asChild, className: _className, type = "button", ...buttonProps } = props;
  void _variant;
  void _size;
  void _asChild;
  void _className;
  return <button type={type} className={composed} {...buttonProps} />;
}
