import Link from "next/link";
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
      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-center transition hover:border-[#74d3b4]/30 hover:bg-white/[0.08]"
    >
      <span className="block text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#9dd5e3]">{label}</span>
      <strong className={`mt-0.5 block text-lg font-black leading-none ${active ? "text-white" : "text-[#8eb5c8]"}`}>
        {value}
      </strong>
    </Link>
  );
}

export function AdminPriorityCard({
  priorityTotal,
  counts,
}: {
  priorityTotal: number;
  counts: PriorityCounts;
}) {
  return (
    <Card tone="dark" className="admin-priority-compact mb-4 overflow-hidden p-0">
      <div
        className="absolute inset-0 bg-[radial-gradient(420px_180px_at_0%_0%,rgba(116,211,180,0.14),transparent_60%),radial-gradient(360px_160px_at_100%_0%,rgba(117,199,232,0.10),transparent_58%)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#74d3b4]/20 bg-[#74d3b4]/10 px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.16em] text-[#9af7c9]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]" aria-hidden />
            Prioridad del día
          </div>
          <h2 className="mt-2 text-lg font-black tracking-tight text-white sm:text-xl">{priorityTitle(priorityTotal)}</h2>
          <p className="mt-1 text-sm font-semibold text-[#b8d2df]">Cola financiera, soporte y webhooks.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/payments"
              className="rounded-md bg-[#74d3b4] px-3 py-1.5 text-xs font-black text-[#062235] transition hover:bg-[#9af7c9]"
            >
              Revisar cola
            </Link>
            <Link
              href="/admin/audit"
              className="rounded-md border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-black text-white transition hover:border-white/20 hover:bg-white/[0.09]"
            >
              Auditoría
            </Link>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[min(100%,22rem)]">
          <PriorityStat label="Pagos" value={counts.pendingPayments} href="/admin/payments" />
          <PriorityStat label="Tickets" value={counts.openTickets} href="/admin/support" />
          <PriorityStat label="Reembolsos" value={counts.pendingRefunds} href="/admin/refunds" />
          <PriorityStat label="Webhooks" value={counts.failedWebhooks} href="/admin/webhooks" />
        </div>
      </div>
    </Card>
  );
}
