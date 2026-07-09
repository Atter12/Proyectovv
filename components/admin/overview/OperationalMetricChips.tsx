import Link from "next/link";

type PriorityCounts = {
  pendingPayments: number;
  pendingRefunds: number;
  openTickets: number;
  failedWebhooks: number;
};

const OPERATIONAL_METRICS = [
  { key: "pendingPayments", label: "Pagos", shortLabel: "Pagos", href: "/admin/payments" },
  { key: "openTickets", label: "Tickets", shortLabel: "Tickets", href: "/admin/support" },
  { key: "pendingRefunds", label: "Reembolsos", shortLabel: "Reemb.", href: "/admin/refunds" },
  { key: "failedWebhooks", label: "Webhooks", shortLabel: "Webhooks", href: "/admin/webhooks" },
] as const satisfies ReadonlyArray<{
  key: keyof PriorityCounts;
  label: string;
  shortLabel: string;
  href: string;
}>;

function OperationalMetricChip({
  label,
  shortLabel,
  value,
  href,
}: {
  label: string;
  shortLabel: string;
  value: number;
  href: string;
}) {
  const active = value > 0;

  return (
    <Link
      href={href}
      title={label}
      className="flex h-[2.625rem] min-w-0 w-full flex-col justify-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 transition hover:border-[#178BFF]/30 hover:bg-[#EAF4FF]/50"
    >
      <span className="truncate text-[0.625rem] font-medium leading-none text-slate-500">{shortLabel}</span>
      <strong
        className={`truncate text-base font-semibold leading-none tabular-nums ${active ? "text-slate-900" : "text-slate-400"}`}
      >
        {value}
      </strong>
    </Link>
  );
}

export function OperationalMetricChips({ counts }: { counts: PriorityCounts }) {
  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:min-w-[10.5rem] lg:min-w-[12.25rem]">
      {OPERATIONAL_METRICS.map((metric) => (
        <OperationalMetricChip
          key={metric.key}
          label={metric.label}
          shortLabel={metric.shortLabel}
          value={counts[metric.key]}
          href={metric.href}
        />
      ))}
    </div>
  );
}
