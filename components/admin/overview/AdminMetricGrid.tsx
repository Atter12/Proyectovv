import { AdminMetricCard, type AdminMetricAccent } from "./AdminMetricCard";
import type { AdminOverviewMetric } from "./buildOverviewMetrics";
import { cn } from "@/lib/cn";

export type { AdminMetricAccent, AdminOverviewMetric };

type AdminMetricGridLayout = "default" | "executive";

export function AdminMetricGrid({
  metrics,
  layout = "default",
}: {
  metrics: AdminOverviewMetric[];
  layout?: AdminMetricGridLayout;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        layout === "executive"
          ? "h-full min-h-0 auto-rows-fr gap-4 sm:grid-cols-2"
          : "mb-6 gap-5 sm:grid-cols-2 xl:grid-cols-4",
      )}
    >
      {metrics.map((metric) => (
        <AdminMetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.detail}
          accent={metric.accent}
          emphasized={metric.emphasized}
          stretch={layout === "executive"}
        />
      ))}
    </div>
  );
}
