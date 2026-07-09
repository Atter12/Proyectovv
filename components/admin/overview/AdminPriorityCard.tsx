import Link from "next/link";
import { OperationalMetricChips } from "@/components/admin/overview/OperationalMetricChips";
import { OperationalProgressDonut } from "@/components/admin/overview/OperationalProgressDonut.client";
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
      <Link
        href="/admin/payments"
        className="rounded-lg bg-[#6bc4a5] px-3 py-1.5 text-xs font-semibold text-[#062235] transition duration-150 ease-out hover:bg-[#84d3b8]"
      >
        Revisar cola
      </Link>
      <Link
        href="/admin/audit"
        className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/90 transition duration-150 ease-out hover:border-white/16 hover:bg-white/[0.07]"
      >
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
    <Card tone="dark" className={cn("admin-priority-compact overflow-hidden p-0", className)}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(380px_140px_at_0%_0%,rgba(116,211,180,0.06),transparent_62%),radial-gradient(320px_120px_at_100%_0%,rgba(117,199,232,0.04),transparent_58%)]"
        aria-hidden
      />

      <div className="relative flex h-full min-h-0 flex-col p-5 sm:p-6">
        <div className="grid min-h-0 flex-1 gap-6 max-lg:grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_auto_minmax(11.5rem,12.5rem)] lg:items-center">
          <div className="min-w-0 space-y-4">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#74d3b4]/12 bg-[#74d3b4]/6 px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-[0.07em] text-[#9dd5e3]/90">
                <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]/85" aria-hidden />
                Prioridad del día
              </div>
              <h2 className="text-[1.05rem] font-semibold tracking-tight text-white sm:text-lg">
                {priorityTitle(priorityTotal)}
              </h2>
              <p className="text-sm font-medium tracking-[0.005em] text-[#b0c8d6]">
                Cola financiera, soporte y webhooks.
              </p>
              <p className="text-xs font-medium tracking-[0.01em] text-[#9ab7c8]">
                {priorityOperationalHint(counts, priorityTotal)}
              </p>
            </div>
            <PriorityActions />
          </div>

          <div className="flex min-w-0 justify-center px-2 lg:px-3">
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
