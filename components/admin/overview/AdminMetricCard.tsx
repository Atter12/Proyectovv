import { AdminMetricIcon } from "./AdminMetricIcon";
import { adminMotion, adminRadius } from "@/components/admin/adminDesignSystem";
import { adminPanelTypography } from "./adminPanelTypography";
import { cn } from "@/lib/cn";

export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<AdminMetricAccent, { iconWrap: string }> = {
  indigo: { iconWrap: "bg-[#EAF4FF] text-[#178BFF]" },
  emerald: { iconWrap: "bg-emerald-50 text-emerald-600" },
  amber: { iconWrap: "bg-amber-50 text-amber-600" },
  rose: { iconWrap: "bg-rose-50 text-rose-600" },
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
        "admin-metric-card relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        adminRadius.metric,
        adminMotion.base,
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        showAlert && "border-amber-200/90 bg-amber-50/40",
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
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.625rem] font-semibold text-amber-700">
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
