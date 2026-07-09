import { AdminMetricIcon } from "./AdminMetricIcon";
import { adminMotion, adminRadius } from "@/components/admin/adminDesignSystem";
import { adminPanelTypography } from "./adminPanelTypography";
import { cn } from "@/lib/cn";

export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<AdminMetricAccent, { iconWrap: string }> = {
  indigo: { iconWrap: "bg-[var(--admin-metric-accent-indigo)] text-[var(--admin-metric-accent-indigo-text)]" },
  emerald: { iconWrap: "bg-[var(--admin-metric-accent-emerald)] text-[var(--admin-metric-accent-emerald-text)]" },
  amber: { iconWrap: "bg-[var(--admin-metric-accent-amber)] text-[var(--admin-metric-accent-amber-text)]" },
  rose: { iconWrap: "bg-[var(--admin-metric-accent-rose)] text-[var(--admin-metric-accent-rose-text)]" },
};

export function AdminMetricCard({
  label,
  value,
  detail,
  accent = "indigo",
  emphasized = false,
  stretch = false,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: AdminMetricAccent;
  emphasized?: boolean;
  stretch?: boolean;
}) {
  const style = accentStyles[accent];
  const showAlert = accent === "rose" && emphasized;

  return (
    <article
      className={cn(
        "admin-metric-card relative overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-1)]",
        adminRadius.metric,
        adminMotion.base,
        "hover:-translate-y-0.5 hover:border-[var(--admin-border-strong)] hover:shadow-[var(--admin-shadow-2)]",
        showAlert && "border-[var(--admin-warning)]/30 bg-[var(--admin-metric-accent-amber)]/40",
        stretch ? "flex h-full min-h-0 flex-col" : "",
      )}
    >
      <div
        className={cn(
          "relative flex h-full flex-col justify-between px-5 py-4",
          stretch ? "min-h-0 flex-1" : "",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div
            className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", style.iconWrap)}
            aria-hidden
          >
            <AdminMetricIcon accent={accent} emphasized={showAlert} />
          </div>
          {showAlert ? (
            <span className="rounded-full bg-[var(--admin-badge-warning-bg)] px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--admin-badge-warning-text)]">
              Alerta
            </span>
          ) : null}
        </div>

        <div className="mt-3.5 min-w-0 space-y-1">
          <p className={adminPanelTypography.metricLabel}>{label}</p>
          <p className={adminPanelTypography.metricValue}>{value}</p>
          {detail ? <p className={adminPanelTypography.metricHelper}>{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}
