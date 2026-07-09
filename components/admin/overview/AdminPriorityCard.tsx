import Link from "next/link";
import { OperationalMetricChips } from "@/components/admin/overview/OperationalMetricChips";
import { OperationalProgressDonut } from "@/components/admin/overview/OperationalProgressDonut.client";
import { buttonClass } from "@/components/ui/Button";
import type { OperationalMonthlyProgress } from "@/lib/admin/data";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";

type PriorityCounts = {
  pendingPayments: number;
  pendingRefunds: number;
  openTickets: number;
  failedWebhooks: number;
};

function priorityTitle(total: number): string {
  if (total === 0) return "Cola operativa limpia";
  if (total === 1) return "1 pendiente operativo";
  return `${total} pendientes operativos`;
}

function priorityOperationalHint(counts: PriorityCounts, total: number): string {
  if (total === 0) return "Sin incidencias activas.";

  const financialLoad = counts.pendingPayments + counts.pendingRefunds;
  const supportLoad = counts.openTickets + counts.failedWebhooks;

  if (financialLoad > 0 && financialLoad >= supportLoad) {
    return "Pagos y reembolsos concentran la carga actual.";
  }

  if (counts.openTickets > 0 && counts.openTickets >= financialLoad) {
    return "Tickets abiertos concentran la carga actual.";
  }

  if (counts.failedWebhooks > 0) {
    return "Webhooks fallidos pendientes de revisión.";
  }

  return "Revisar la cola operativa prioritaria.";
}

function PriorityActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin/payments" className={buttonClass("primary", "sm")}>
        Revisar cola
      </Link>
      <Link href="/admin/audit" className={buttonClass("outline", "sm")}>
        Auditoría
      </Link>
    </div>
  );
}

export function AdminPriorityCard({
  priorityTotal,
  counts,
  operationalProgress,
  className,
}: {
  priorityTotal: number;
  counts: PriorityCounts;
  operationalProgress: OperationalMonthlyProgress;
  className?: string;
}) {
  return (
    <Card tone="default" padding="none" className={cn("admin-priority-compact overflow-hidden", className)}>
      <div className="relative flex h-full min-h-0 flex-col p-5 sm:p-6">
        <div className="grid min-h-0 flex-1 gap-5 max-lg:grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_auto_minmax(11.5rem,12.5rem)] lg:items-center lg:gap-6">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-blue-700">
                <span className="h-1.5 w-1.5 rounded-full bg-[#178BFF]" aria-hidden />
                Prioridad del día
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">{priorityTitle(priorityTotal)}</h2>
              <p className="text-sm text-slate-600">Cola financiera, soporte y webhooks.</p>
              <p className="text-xs text-slate-500">{priorityOperationalHint(counts, priorityTotal)}</p>
            </div>
            <PriorityActions />
          </div>

          <div className="flex min-w-0 justify-center px-1 lg:px-2">
            <OperationalProgressDonut {...operationalProgress} integrated />
          </div>

          <div className="min-w-0 lg:justify-self-end">
            <OperationalMetricChips counts={counts} />
          </div>
        </div>
      </div>
    </Card>
  );
}
