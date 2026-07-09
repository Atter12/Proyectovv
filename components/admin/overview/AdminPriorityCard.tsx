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
        className="rounded-md bg-[#74d3b4] px-2.5 py-1 text-xs font-semibold text-[#062235] transition hover:bg-[#9af7c9]"
      >
        Revisar cola
      </Link>
      <Link
        href="/admin/audit"
        className="rounded-md border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.09]"
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
    <Card tone="dark" className={cn("admin-priority-compact overflow-hidden p-0 ring-0", className)}>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(380px_140px_at_0%_0%,rgba(116,211,180,0.1),transparent_62%),radial-gradient(320px_120px_at_100%_0%,rgba(117,199,232,0.06),transparent_58%)]"
        aria-hidden
      />

      <div className="relative flex h-full min-h-0 flex-col p-3.5 sm:p-4">
        <div className="grid min-h-0 flex-1 gap-4 max-lg:grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_auto_minmax(11.5rem,12.75rem)] lg:items-center lg:gap-5">
          <div className="min-w-0 space-y-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-md border border-[#74d3b4]/20 bg-[#74d3b4]/10 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-[#9af7c9]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]" aria-hidden />
                Prioridad del día
              </div>
              <h2 className="text-base font-bold tracking-tight text-white sm:text-[1.05rem]">
                {priorityTitle(priorityTotal)}
              </h2>
              <p className="text-xs font-medium text-[#b8d2df] sm:text-sm">
                Cola financiera, soporte y webhooks.
              </p>
              <p className="text-[0.75rem] font-medium text-[#9dd5e3]">
                {priorityOperationalHint(counts, priorityTotal)}
              </p>
            </div>
            <PriorityActions />
          </div>

          <div className="flex min-w-0 justify-center lg:justify-center">
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
