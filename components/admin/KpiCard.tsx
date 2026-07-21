import { Card } from "@/components/ui/Card";
import { adminPanelTypography } from "@/components/admin/overview/adminPanelTypography";

const accentStyles = {
  indigo: {
    icon: "bg-[var(--admin-metric-accent-indigo)] text-[var(--admin-metric-accent-indigo-text)]",
    label: "text-[var(--admin-text-muted)]",
  },
  emerald: {
    icon: "bg-[var(--admin-metric-accent-emerald)] text-[var(--admin-metric-accent-emerald-text)]",
    label: "text-[var(--admin-text-muted)]",
  },
  amber: {
    icon: "bg-[var(--admin-metric-accent-amber)] text-[var(--admin-metric-accent-amber-text)]",
    label: "text-[var(--admin-text-muted)]",
  },
  rose: {
    icon: "bg-[var(--admin-metric-accent-rose)] text-[var(--admin-metric-accent-rose-text)]",
    label: "text-[var(--admin-text-muted)]",
  },
  slate: {
    icon: "bg-[var(--admin-badge-neutral-bg)] text-[var(--admin-badge-neutral-text)]",
    label: "text-[var(--admin-text-muted)]",
  },
};

export function KpiCard({
  label,
  value,
  detail,
  accent = "indigo",
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "slate";
}) {
  const style = accentStyles[accent];

  return (
    <Card className="admin-kpi-card p-0" elevated>
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-sm font-medium ${style.label}`}>{label}</p>
            <p className={`mt-2 ${adminPanelTypography.metricValue}`}>{value}</p>
          </div>
          <div
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-semibold ${style.icon}`}
            aria-hidden
          >
            •
          </div>
        </div>
        {detail ? <p className={`mt-3 ${adminPanelTypography.metricHelper}`}>{detail}</p> : null}
      </div>
    </Card>
  );
}
