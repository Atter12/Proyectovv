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

const OPERATIONAL_METRICS = [
  { key: "pendingPayments", label: "Pagos", href: "/admin/payments" },
  { key: "openTickets", label: "Tickets", href: "/admin/support" },
  { key: "pendingRefunds", label: "Reembolsos", href: "/admin/refunds" },
  { key: "failedWebhooks", label: "Webhooks", href: "/admin/webhooks" },
] as const satisfies ReadonlyArray<{
  key: keyof PriorityCounts;
  label: string;
  href: string;
}>;

function priorityTitle(total: number): string {
  if (total === 0) return "Cola operativa al día";
  if (total === 1) return "1 asunto requiere atención";
  return `${total} asuntos requieren atención`;
}

function PriorityActions() {
  return (
    <div className="flex flex-wrap gap-2">
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
  );
}

function OperationalMetricChip({
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
      className="flex min-h-[3.35rem] flex-col justify-between rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2 transition hover:border-[#74d3b4]/24 hover:bg-white/[0.08]"
    >
      <span className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#9dd5e3]">{label}</span>
      <strong className={`text-lg font-black leading-none ${active ? "text-white" : "text-[#8eb5c8]"}`}>{value}</strong>
    </Link>
  );
}

function OperationalMetricGrid({ counts }: { counts: PriorityCounts }) {
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:max-w-[11.5rem] lg:max-w-[12.5rem]">
      {OPERATIONAL_METRICS.map((metric) => (
        <OperationalMetricChip
          key={metric.key}
          label={metric.label}
          value={counts[metric.key]}
          href={metric.href}
        />
      ))}
    </div>
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

      <div className="relative p-3 sm:p-3.5">
        <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-[#74d3b4]/20 bg-[#74d3b4]/10 px-2 py-0.5 text-[0.56rem] font-black uppercase tracking-[0.14em] text-[#9af7c9]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]" aria-hidden />
            Prioridad del día
          </div>
          <h2 className="text-base font-black tracking-tight text-white sm:text-[1.05rem]">{priorityTitle(priorityTotal)}</h2>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <div className="min-w-0 space-y-2.5 lg:max-w-[48%] lg:flex-1">
            <p className="text-xs font-semibold text-[#b8d2df] sm:text-sm">Cola financiera, soporte y webhooks.</p>
            <PriorityActions />
          </div>

          <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:max-w-[52%] lg:gap-4">
            <div className="order-2 w-full sm:order-1 sm:w-auto">
              <OperationalMetricGrid counts={counts} />
            </div>
            <div className="order-1 shrink-0 sm:order-2">
              <OperationalProgressDonut {...operationalProgress} integrated />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
