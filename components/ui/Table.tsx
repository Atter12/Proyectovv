import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  embedded?: boolean;
}

export function Table({ className, embedded = false, ...props }: TableProps) {
  if (embedded) return <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />;

  return (
    <div className="scrollbar-thin w-full overflow-x-auto rounded-xl bg-white/[0.9] shadow-[var(--admin-shadow-1)]">
      <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableWrap({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "admin-table-wrap scrollbar-thin overflow-x-auto rounded-xl bg-white/[0.88] shadow-[var(--admin-shadow-1)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[#f6fafb]/90", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-[#edf2f5]", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors duration-150 ease-out hover:bg-[#f8fcfd]", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6d8494] sm:px-4",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 text-[#29465a] sm:whitespace-nowrap", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={cn(
        "bg-[#f6fafb]/95 px-4 py-2.5 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#6d8494] first:rounded-tl-xl last:rounded-tr-xl",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("px-4 py-3 align-middle text-sm text-[#29465a]", className)} {...props} />;
}
