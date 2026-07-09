import { cn } from "@/lib/cn";
import type { ComponentPropsWithoutRef, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  embedded?: boolean;
}

export function Table({ className, embedded = false, ...props }: TableProps) {
  if (embedded) return <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />;

  return (
    <div className="scrollbar-thin w-full overflow-x-auto rounded-xl bg-white/[0.94] shadow-[var(--admin-shadow-1)]">
      <table className={cn("w-full min-w-[520px] border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function TableWrap({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "admin-table-wrap scrollbar-thin overflow-x-auto rounded-xl bg-white/[0.92] shadow-[var(--admin-shadow-1)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-[#f8fbfc]/95", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-[#f0f4f6]", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors duration-[180ms] ease-out hover:bg-[#f9fbfc]", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 text-left text-[0.6875rem] font-medium uppercase tracking-[0.07em] text-[#6d8494]",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3.5 text-sm font-medium text-[#29465a] sm:whitespace-nowrap", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={cn(
        "bg-[#f8fbfc]/95 px-4 py-3 text-left text-[0.6875rem] font-medium uppercase tracking-[0.07em] text-[#6d8494] first:rounded-tl-xl last:rounded-tr-xl",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return <td className={cn("px-4 py-3.5 align-middle text-sm font-medium text-[#29465a]", className)} {...props} />;
}
