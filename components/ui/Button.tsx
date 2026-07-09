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
    "bg-[var(--admin-accent)] text-white shadow-sm hover:bg-[var(--admin-accent-hover)] active:scale-[0.99]",
  secondary:
    "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)] shadow-sm hover:opacity-90 active:scale-[0.99]",
  outline:
    "border border-[var(--admin-control-border)] bg-[var(--admin-control-bg)] text-[var(--admin-control-muted)] hover:border-[var(--admin-border-strong)] hover:bg-[var(--admin-control-hover-bg)] hover:text-[var(--admin-control-text)]",
  ghost:
    "text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)]",
  luxury:
    "bg-[linear-gradient(135deg,var(--admin-accent),#60A5FA)] text-white shadow-sm hover:shadow-md active:scale-[0.99]",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.99]",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-9 px-4 text-sm rounded-lg",
  lg: "h-11 px-6 text-sm rounded-lg",
};

const baseClass =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:pointer-events-none disabled:opacity-45";

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(baseClass, variantClasses[variant], sizeClasses[size], className);
}

export function Button(props: NativeButtonProps | LinkButtonProps) {
  const { variant = "primary", size = "md", className } = props;
  const composed = buttonClass(variant, size, className);

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
