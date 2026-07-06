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
        "rounded-[1.45rem] border border-white/70 bg-white/70 p-5 shadow-[var(--shadow-card)] backdrop-blur-xl flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="max-w-3xl text-sm font-medium leading-relaxed text-[#64748b]">
          {description}
        </p>
      </div>
      {badges ? (
        <div className="flex shrink-0 flex-wrap gap-2">{badges}</div>
      ) : null}
    </div>
  );
}
