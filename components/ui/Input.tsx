import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-white px-3.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-[#4056ff]/50 focus:outline-none focus:ring-2 focus:ring-[#4056ff]/15",
        className,
      )}
      {...props}
    />
  );
}
