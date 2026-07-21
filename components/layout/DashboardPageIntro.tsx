import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface DashboardPageIntroProps {
  description: string;
  badges?: ReactNode;
  className?: string;
}

export function DashboardPageIntro({
  description,
  badges,
  className,
}: DashboardPageIntroProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-white p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="max-w-3xl text-[15px] leading-7 text-[var(--admin-text-muted,#64748b)]">
          {description}
        </p>
      </div>
      {badges ? (
        <div className="flex shrink-0 flex-wrap gap-2">{badges}</div>
      ) : null}
    </div>
  );
}
