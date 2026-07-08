import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  embedded?: boolean;
}

export function Table({ className, embedded = false, ...props }: TableProps) {
  if (embedded) {
    return <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />;
  }

  return (
    <div className="scrollbar-thin w-full overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)] ring-1 ring-black/[0.02]">
      <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableWrap({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("scrollbar-thin overflow-x-auto rounded-[1.35rem] border border-slate-200 bg-white", className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-slate-50/90 backdrop-blur-sm", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-slate-100/80", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors duration-150 hover:bg-[#4056ff]/[0.02]", className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap px-3 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-4", className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-3.5 text-slate-700 sm:px-4 sm:whitespace-nowrap", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return <th className={cn("px-4 py-3 text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("px-4 py-4 align-top text-sm text-slate-700", className)} {...props} />;
}
