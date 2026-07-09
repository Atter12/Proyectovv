import { adminPanelTypography } from "@/components/admin/overview/adminPanelTypography";
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
        {eyebrow ? <p className={adminPanelTypography.sectionEyebrow}>{eyebrow}</p> : null}
        <h2 className={cn(adminPanelTypography.sectionTitle, !eyebrow && "mt-0")}>{title}</h2>
        {subtitle ? <p className={adminPanelTypography.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
