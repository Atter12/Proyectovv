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
      className="flex min-h-[2.75rem] min-w-0 flex-col justify-between rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 transition hover:border-[#74d3b4]/28 hover:bg-white/[0.09]"
    >
      <span className="whitespace-nowrap text-[0.58rem] font-black uppercase tracking-[0.04em] text-[#9dd5e3]">
        {shortLabel}
      </span>
      <strong className={`text-base font-black leading-none sm:text-lg ${active ? "text-white" : "text-[#8eb5c8]"}`}>
        {value}
      </strong>
    </Link>
  );
}

export function OperationalMetricChips({ counts }: { counts: PriorityCounts }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:min-w-[10.5rem] lg:min-w-[12.25rem]">
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
