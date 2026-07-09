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
    "bg-[#178BFF] text-white shadow-sm hover:bg-[#0F7AE5] active:scale-[0.99]",
  secondary:
    "bg-[#EAF4FF] text-[#178BFF] shadow-sm hover:bg-[#D6EBFF] active:scale-[0.99]",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  luxury:
    "bg-[linear-gradient(135deg,#178BFF,#60A5FA)] text-white shadow-sm hover:shadow-md active:scale-[0.99]",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.99]",
  success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:scale-[0.99]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-9 px-4 text-sm rounded-lg",
  lg: "h-11 px-6 text-sm rounded-lg",
};

const baseClass =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#178BFF]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45";

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
