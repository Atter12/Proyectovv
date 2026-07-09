export type AdminMetricAccent = "indigo" | "emerald" | "amber" | "rose";

const accentStyles: Record<
  AdminMetricAccent,
  { card: string; stripe: string; icon: string; label: string; symbol: string }
> = {
  indigo: {
    card: "border-[#c5e4ee] bg-[linear-gradient(135deg,#f7fcfe_0%,#eef7fb_100%)]",
    stripe: "bg-[#0e7490]",
    icon: "bg-[#0e7490]/10 text-[#0e7490] ring-[#bfe4ee]",
    label: "text-[#23718b]",
    symbol: "Org",
  },
  emerald: {
    card: "border-[#b9ead8] bg-[linear-gradient(135deg,#f3fff9_0%,#e9faf2_100%)]",
    stripe: "bg-[#59c493]",
    icon: "bg-[#59c493]/12 text-[#1f9272] ring-[#b9f0d7]",
    label: "text-[#1f7f68]",
    symbol: "$",
  },
  amber: {
    card: "border-[#f0dfa8] bg-[linear-gradient(135deg,#fffdf6_0%,#fff7e4_100%)]",
    stripe: "bg-[#f4c95d]",
    icon: "bg-[#f4c95d]/16 text-[#9a6a13] ring-[#f7dfaa]",
    label: "text-[#9a6a13]",
    symbol: "Pay",
  },
  rose: {
    card: "border-[#f0c5d0] bg-[linear-gradient(135deg,#fff9fb_0%,#fff0f4_100%)]",
    stripe: "bg-[#e76f8a]",
    icon: "bg-[#e76f8a]/12 text-[#c35670] ring-[#f3c0cd]",
    label: "text-[#a1485d]",
    symbol: "!",
  },
};

export function AdminMetricCard({
  label,
  value,
  detail,
  accent = "indigo",
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: AdminMetricAccent;
}) {
  const style = accentStyles[accent];

  return (
    <article
      className={`admin-metric-card group relative overflow-hidden rounded-xl border shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_10px_28px_rgba(14,48,72,0.05)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(14,48,72,0.08)] ${style.card}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${style.stripe}`} aria-hidden />
      <div className="flex items-center gap-3 px-3.5 py-3 pl-4">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[0.62rem] font-black uppercase tracking-wide ring-1 ${style.icon}`}
          aria-hidden
        >
          {style.symbol}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[0.62rem] font-black uppercase tracking-[0.14em] ${style.label}`}>{label}</p>
          <p className="truncate text-[1.35rem] font-black leading-tight tracking-tight text-[#061925]">{value}</p>
          {detail ? <p className="truncate text-xs font-bold text-[#6d8494]">{detail}</p> : null}
        </div>
      </div>
    </article>
  );
}
