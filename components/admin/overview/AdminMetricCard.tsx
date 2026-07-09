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
    stripe: "bg-[#3d8fa8]",
    iconWrap: "bg-[#f4f9fb] text-[#3d8fa8]",
  },
  emerald: {
    surface: "bg-white",
    stripe: "bg-[#4fa882]",
    iconWrap: "bg-[#f3faf7] text-[#3d8f6e]",
  },
  amber: {
    surface: "bg-white",
    stripe: "bg-[#c9a24e]",
    iconWrap: "bg-[#faf8f3] text-[#8a6d2e]",
  },
  rose: {
    surface: "bg-white",
    stripe: "bg-[#c96a82]",
    iconWrap: "bg-[#faf5f7] text-[#a84d66]",
  },
};

const roseEmphasizedStyles = {
  surface: "bg-[#fffbfc]",
  stripe: "bg-[#b85a72] w-[3px]",
  iconWrap: "bg-[#faf0f3] text-[#a84d66] ring-1 ring-[#ecd0d8]/80",
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
        "admin-metric-card relative overflow-hidden border border-[var(--admin-content-border)]",
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
          "relative flex items-center gap-3 px-4 py-4 pl-[0.9rem]",
          stretch ? "min-h-0 flex-1" : "",
        )}
      >
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            style.iconWrap,
          )}
          aria-hidden
        >
          <AdminMetricIcon accent={accent} emphasized={accent === "rose" && emphasized} />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className={adminPanelTypography.metricLabel}>{label}</p>
          <p className={adminPanelTypography.metricValue}>{value}</p>
          {detail ? <p className={adminPanelTypography.metricHelper}>{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}
