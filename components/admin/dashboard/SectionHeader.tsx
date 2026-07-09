import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-slate-500">{eyebrow}</p>
        ) : null}
        <h2 className={cn("font-semibold tracking-tight text-slate-900", eyebrow ? "mt-1 text-base" : "text-base")}>
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
