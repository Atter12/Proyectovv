import { AdminMetricIcon } from "./AdminMetricIcon";
import { adminPanelTypography } from "./adminPanelTypography";
import { cn } from "@/lib/cn";

export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<
  AdminMetricAccent,
  {
    surface: string;
    border: string;
    stripe: string;
    iconWrap: string;
  }
> = {
  indigo: {
    surface: "bg-gradient-to-br from-[#eef8fb] to-[#e3f2f8]",
    border: "border-[#c5e0ea]",
    stripe: "bg-[#0e7490]",
    iconWrap: "bg-white/85 text-[#0e7490] ring-1 ring-[#cfe8ee]",
  },
  emerald: {
    surface: "bg-gradient-to-br from-[#f0faf6] to-[#e8f5ef]",
    border: "border-[#c8e8d8]",
    stripe: "bg-[#59c493]",
    iconWrap: "bg-white/85 text-[#1a8f6e] ring-1 ring-[#ccefe0]",
  },
  amber: {
    surface: "bg-gradient-to-br from-[#fffbf0] to-[#fff6e5]",
    border: "border-[#ecd9a0]",
    stripe: "bg-[#d4a843]",
    iconWrap: "bg-white/85 text-[#8f6410] ring-1 ring-[#f0e0b8]",
  },
  rose: {
    surface: "bg-gradient-to-br from-[#fff8f9] to-[#fff0f3]",
    border: "border-[#ebc0cc]",
    stripe: "bg-[#e76f8a]",
    iconWrap: "bg-white/85 text-[#b84d66] ring-1 ring-[#f3d0da]",
  },
};

const roseEmphasizedStyles = {
  surface: "bg-gradient-to-br from-[#fff5f7] to-[#ffe8ee]",
  border: "border-[#deb0bc] ring-1 ring-[#ebc0cc]/55",
  stripe: "bg-[#d45d7a] w-1.5",
  iconWrap: "bg-[#fff0f4] text-[#a83d58] ring-1 ring-[#e8b4c0]",
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
  const stripeWidth = accent === "rose" && emphasized ? "" : "w-1";

  return (
    <article
      className={cn(
        "admin-metric-card relative overflow-hidden rounded-xl border shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_8px_24px_rgba(14,48,72,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(14,48,72,0.08)]",
        style.surface,
        style.border,
        stretch ? "flex h-full min-h-0 flex-col" : "",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0", stripeWidth, style.stripe)} aria-hidden />

      <div
        className={cn(
          "relative flex items-start gap-3 px-4 py-3.5 pl-[1.1rem]",
          stretch ? "min-h-0 flex-1" : "",
        )}
      >
        <div
          className={cn(
            "mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            style.iconWrap,
            accent === "rose" && emphasized ? "shadow-[0_0_0_1px_rgba(216,93,122,0.12)]" : "",
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
