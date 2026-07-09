import { AdminMetricCard, type AdminMetricAccent } from "./AdminMetricCard";

export type AdminOverviewMetric = {
  label: string;
  value: string;
  detail?: string;
  accent: AdminMetricAccent;
};

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
