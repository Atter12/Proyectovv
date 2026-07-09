import { AdminMetricIcon } from "./AdminMetricIcon";
import { adminMotion, adminRadius } from "@/components/admin/adminDesignSystem";
import { adminPanelTypography } from "./adminPanelTypography";
import { cn } from "@/lib/cn";

export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<
  AdminMetricAccent,
  {
    iconWrap: string;
    trend?: string;
  }
> = {
  indigo: {
    iconWrap: "bg-[#EAF4FF] text-[#178BFF]",
  },
  emerald: {
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
  amber: {
    iconWrap: "bg-amber-50 text-amber-600",
  },
  rose: {
    iconWrap: "bg-rose-50 text-rose-600",
  },
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
        "admin-metric-card relative bg-white",
        adminRadius.metric,
        adminMotion.base,
        "hover:-translate-y-px",
        showAlert && "border-amber-200/80 bg-amber-50/30",
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
            className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", style.iconWrap)}
            aria-hidden
          >
            <AdminMetricIcon accent={accent} emphasized={showAlert} />
          </div>
          {showAlert ? (
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[0.625rem] font-medium text-amber-700">
              Alerta
            </span>
          ) : null}
        </div>

        <div className="mt-4 min-w-0 space-y-1">
          <p className={adminPanelTypography.metricLabel}>{label}</p>
          <p className={adminPanelTypography.metricValue}>{value}</p>
          {detail ? <p className={adminPanelTypography.metricHelper}>{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}
