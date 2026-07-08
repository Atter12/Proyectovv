import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  embedded?: boolean;
}

export function Table({ className, embedded = false, ...props }: TableProps) {
  if (embedded) return <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />;

  return (
    <div className="scrollbar-thin w-full overflow-x-auto rounded-[1.15rem] border border-[#d5e8ee] bg-white/[0.82] shadow-[var(--shadow-card)] ring-1 ring-white/80 backdrop-blur-xl">
      <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableWrap({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("admin-table-wrap scrollbar-thin overflow-x-auto rounded-[1.15rem] border border-[#d5e8ee] bg-white/[0.72] ring-1 ring-white/70 backdrop-blur-xl", className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[#eef8fb]/80 backdrop-blur-sm", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-[#e1edf2]", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors duration-150 hover:bg-[#f1fff8]", className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("whitespace-nowrap px-3 py-3.5 text-left text-[11px] font-black uppercase tracking-wider text-[#5d7280] sm:px-4", className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-3.5 text-[#29465a] sm:px-4 sm:whitespace-nowrap", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return <th className={cn("bg-[#eef8fb]/90 px-4 py-3 text-left text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#587080] first:rounded-l-xl last:rounded-r-xl", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("px-4 py-4 align-top text-sm text-[#29465a]", className)} {...props} />;
}
