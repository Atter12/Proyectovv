import Link from "next/link";

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
      className="flex min-h-[2.85rem] min-w-0 flex-col justify-between rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2 transition hover:border-[#74d3b4]/28 hover:bg-white/[0.09]"
    >
      <span className="truncate text-[0.58rem] font-black uppercase tracking-[0.07em] text-[#9dd5e3]">
        {label}
      </span>
      <strong className={`text-base font-black leading-none sm:text-lg ${active ? "text-white" : "text-[#8eb5c8]"}`}>
        {value}
      </strong>
    </Link>
  );
}

export function OperationalMetricChips({ counts }: { counts: PriorityCounts }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-[9.75rem] lg:min-w-[10.5rem]">
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
