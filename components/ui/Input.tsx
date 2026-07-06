import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-white/90 px-3.5 text-sm text-slate-950 shadow-sm shadow-slate-950/[0.03] transition-all placeholder:text-slate-400 focus:border-[#4056ff]/55 focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#4056ff]/10",
        className,
      )}
      {...props}
    />
  );
}
