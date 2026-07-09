import { AdminMetricIcon } from "./AdminMetricIcon";
import { adminMotion, adminRadius, adminShadow } from "@/components/admin/adminDesignSystem";
import { adminPanelTypography } from "./adminPanelTypography";
import { cn } from "@/lib/cn";

export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<
  AdminMetricAccent,
  {
    surface: string;
    stripe: string;
    iconWrap: string;
  }
> = {
  indigo: {
    surface: "bg-white",
    stripe: "bg-[#4a8fa3]",
    iconWrap: "bg-[#f6fafb] text-[#4a8fa3]",
  },
  emerald: {
    surface: "bg-white",
    stripe: "bg-[#5a9e7f]",
    iconWrap: "bg-[#f6faf8] text-[#4d9172]",
  },
  amber: {
    surface: "bg-white",
    stripe: "bg-[#b89547]",
    iconWrap: "bg-[#faf9f6] text-[#8a6d2e]",
  },
  rose: {
    surface: "bg-white",
    stripe: "bg-[#b86a7f]",
    iconWrap: "bg-[#faf7f8] text-[#a0586c]",
  },
};

const roseEmphasizedStyles = {
  surface: "bg-[#fffcfd]",
  stripe: "bg-[#a8586c] w-[3px]",
  iconWrap: "bg-[#faf3f5] text-[#a0586c]",
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
  const baseStyle = accentStyles[accent];
  const style = accent === "rose" && emphasized ? { ...baseStyle, ...roseEmphasizedStyles } : baseStyle;
  const stripeWidth = accent === "rose" && emphasized ? "" : "w-[2px]";

  return (
    <article
      className={cn(
        "admin-metric-card relative overflow-hidden",
        adminRadius.metric,
        adminShadow.surface,
        adminMotion.base,
        "hover:-translate-y-px hover:shadow-[var(--admin-shadow-3)]",
        style.surface,
        stretch ? "flex h-full min-h-0 flex-col" : "",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0", stripeWidth, style.stripe)} aria-hidden />

      <div
        className={cn(
          "relative flex items-center gap-3.5 px-5 py-4 pl-[1rem]",
          stretch ? "min-h-0 flex-1" : "",
        )}
      >
        <div
          className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-[10px] opacity-90", style.iconWrap)}
          aria-hidden
        >
          <AdminMetricIcon accent={accent} emphasized={accent === "rose" && emphasized} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className={adminPanelTypography.metricLabel}>{label}</p>
          <p className={adminPanelTypography.metricValue}>{value}</p>
          {detail ? <p className={adminPanelTypography.metricHelper}>{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}
