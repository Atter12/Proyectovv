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
    "bg-[#0e7490] text-white shadow-[var(--admin-shadow-1)] hover:bg-[#155e75] hover:shadow-[var(--admin-shadow-2)] active:scale-[0.99]",
  secondary:
    "bg-[#d4f5e6] text-[#063048] shadow-[var(--admin-shadow-1)] hover:bg-[#e2f9ee] active:scale-[0.99]",
  outline:
    "border border-[var(--admin-content-border)] bg-white text-[#16445a] hover:border-[#b8e8d4] hover:bg-[#f7fcfa]",
  ghost: "text-[#5d7280] hover:bg-[#f0f7f9] hover:text-[#063048]",
  luxury:
    "bg-[linear-gradient(135deg,#0e7490,#7dd3b0)] text-white shadow-[var(--admin-shadow-2)] hover:shadow-[var(--admin-shadow-3)] active:scale-[0.99]",
  danger: "bg-rose-600/95 text-white shadow-[var(--admin-shadow-1)] hover:bg-rose-700 active:scale-[0.99]",
  success: "bg-emerald-600/95 text-white shadow-[var(--admin-shadow-1)] hover:bg-emerald-700 active:scale-[0.99]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-9 px-4 text-sm rounded-lg",
  lg: "h-11 px-6 text-sm rounded-lg",
};

const baseClass =
  "inline-flex items-center justify-center gap-2 font-semibold transition-[color,background-color,box-shadow,transform,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e7490]/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

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
