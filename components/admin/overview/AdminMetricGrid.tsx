import { AdminMetricCard, type AdminMetricAccent } from "./AdminMetricCard";
import type { AdminOverviewMetric } from "./buildOverviewMetrics";

export type { AdminMetricAccent, AdminOverviewMetric };

export function AdminMetricGrid({ metrics }: { metrics: AdminOverviewMetric[] }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <AdminMetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          detail={metric.detail}
          accent={metric.accent}
        />
      ))}
    </div>
  );
}
