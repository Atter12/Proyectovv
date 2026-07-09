import { AdminMetricGrid } from "@/components/admin/overview/AdminMetricGrid";
import { AdminPriorityCard } from "@/components/admin/overview/AdminPriorityCard";
import type { OperationalMonthlyProgress } from "@/lib/admin/data";
import type { AdminOverviewMetric } from "./buildOverviewMetrics";

type PriorityCounts = {
  pendingPayments: number;
  pendingRefunds: number;
  openTickets: number;
  failedWebhooks: number;
};

export function AdminExecutiveOverview({
  metrics,
  priorityTotal,
  counts,
  operationalProgress,
}: {
  metrics: AdminOverviewMetric[];
  priorityTotal: number;
  counts: PriorityCounts;
  operationalProgress: OperationalMonthlyProgress;
}) {
  return (
    <section
      className="admin-executive-overview mb-5 grid gap-4 lg:grid-cols-[minmax(0,48%)_minmax(0,52%)] lg:items-stretch"
      aria-label="Resumen ejecutivo"
    >
      <AdminMetricGrid metrics={metrics} layout="executive" />
      <AdminPriorityCard
        priorityTotal={priorityTotal}
        counts={counts}
        operationalProgress={operationalProgress}
        className="h-full"
      />
    </section>
  );
}
