import { Card } from "@/components/ui/Card";
import { adminPanelTypography } from "@/components/admin/overview/adminPanelTypography";

const accentStyles = {
  indigo: { icon: "bg-[#EAF4FF] text-[#178BFF]", label: "text-slate-500" },
  emerald: { icon: "bg-emerald-50 text-emerald-600", label: "text-slate-500" },
  amber: { icon: "bg-amber-50 text-amber-600", label: "text-slate-500" },
  rose: { icon: "bg-rose-50 text-rose-600", label: "text-slate-500" },
  slate: { icon: "bg-slate-100 text-slate-600", label: "text-slate-500" },
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
