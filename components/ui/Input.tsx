import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef, InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-white/90 px-3.5 text-sm text-slate-950 shadow-sm shadow-slate-950/[0.03] transition-all placeholder:text-slate-400 focus:border-[var(--brand-primary)]/55 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[var(--brand-primary)]/10",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100",
        className,
      )}
      {...props}
    />
  );
}
