import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface DashboardPageIntroProps {
  description: string;
  badges?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DashboardPageIntro({
  description,
  badges,
  actions,
  className,
}: DashboardPageIntroProps) {
  return (
    <div
      className={cn(
        "dashboard-surface-card flex flex-col gap-4 rounded-[1.25rem] p-5 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="max-w-3xl text-[15px] font-medium leading-6 text-[var(--auth-text-muted)]">
          {description}
        </p>
        {badges ? (
          <div className="mt-3 flex flex-wrap gap-2">{badges}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
