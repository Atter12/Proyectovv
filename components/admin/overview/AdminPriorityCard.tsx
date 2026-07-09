import Link from "next/link";
import { OperationalProgressDonut } from "@/components/admin/overview/OperationalProgressDonut.client";
import type { OperationalMonthlyProgress } from "@/lib/admin/data";
import { Card } from "@/components/ui/Card";

type PriorityCounts = {
  pendingPayments: number;
  pendingRefunds: number;
  openTickets: number;
  failedWebhooks: number;
};

function priorityTitle(total: number): string {
  if (total === 0) return "Cola operativa al día";
  if (total === 1) return "1 asunto requiere atención";
  return `${total} asuntos requieren atención`;
}

function PriorityStat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  const active = value > 0;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 transition hover:border-[#74d3b4]/28 hover:bg-white/[0.07]"
    >
      <span className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#9dd5e3]">{label}</span>
      <strong className={`text-sm font-black leading-none ${active ? "text-white" : "text-[#8eb5c8]"}`}>{value}</strong>
    </Link>
  );
}

export function AdminPriorityCard({
  priorityTotal,
  counts,
  operationalProgress,
}: {
  priorityTotal: number;
  counts: PriorityCounts;
  operationalProgress: OperationalMonthlyProgress;
}) {
  return (
    <Card tone="dark" className="admin-priority-compact mb-4 overflow-hidden p-0">
      <div
        className="absolute inset-0 bg-[radial-gradient(380px_140px_at_0%_0%,rgba(116,211,180,0.12),transparent_62%),radial-gradient(320px_120px_at_100%_0%,rgba(117,199,232,0.08),transparent_58%)]"
        aria-hidden
      />
      <div className="relative space-y-2.5 p-3 sm:p-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#74d3b4]/20 bg-[#74d3b4]/10 px-2 py-0.5 text-[0.56rem] font-black uppercase tracking-[0.14em] text-[#9af7c9]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]" aria-hidden />
            Prioridad del día
          </div>
          <h2 className="text-base font-black tracking-tight text-white sm:text-[1.05rem]">{priorityTitle(priorityTotal)}</h2>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-2 lg:max-w-[16rem] lg:flex-1">
            <p className="text-xs font-semibold text-[#b8d2df] sm:text-sm">Cola financiera, soporte y webhooks.</p>
            <div className="hidden flex-wrap gap-2 lg:flex">
              <Link
                href="/admin/payments"
                className="rounded-md bg-[#74d3b4] px-2.5 py-1 text-xs font-black text-[#062235] transition hover:bg-[#9af7c9]"
              >
                Revisar cola
              </Link>
              <Link
                href="/admin/audit"
                className="rounded-md border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs font-black text-white transition hover:border-white/20 hover:bg-white/[0.09]"
              >
                Auditoría
              </Link>
            </div>
          </div>

          <OperationalProgressDonut {...operationalProgress} />

          <div className="flex flex-wrap items-center gap-1.5 lg:max-w-[14rem] lg:justify-end">
            <PriorityStat label="Pagos" value={counts.pendingPayments} href="/admin/payments" />
            <PriorityStat label="Tickets" value={counts.openTickets} href="/admin/support" />
            <PriorityStat label="Reembolsos" value={counts.pendingRefunds} href="/admin/refunds" />
            <PriorityStat label="Webhooks" value={counts.failedWebhooks} href="/admin/webhooks" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden">
          <Link
            href="/admin/payments"
            className="rounded-md bg-[#74d3b4] px-2.5 py-1 text-xs font-black text-[#062235] transition hover:bg-[#9af7c9]"
          >
            Revisar cola
          </Link>
          <Link
            href="/admin/audit"
            className="rounded-md border border-white/12 bg-white/[0.05] px-2.5 py-1 text-xs font-black text-white transition hover:border-white/20 hover:bg-white/[0.09]"
          >
            Auditoría
          </Link>
        </div>
      </div>
    </Card>
  );
}
