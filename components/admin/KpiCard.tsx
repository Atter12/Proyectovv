import { Card } from "@/components/ui/Card";

const accentStyles = {
  indigo: {
    label: "text-[#23718b]",
    icon: "bg-[#e8f8fb] text-[#0e7490] ring-[#bfe4ee]",
    line: "from-[#0e7490] via-[#74d3b4] to-transparent",
    dot: "bg-[#0e7490]",
    symbol: "◇",
  },
  emerald: {
    label: "text-[#1f7f68]",
    icon: "bg-[#eafff6] text-[#1f9272] ring-[#b9f0d7]",
    line: "from-[#59c493] via-[#9af7c9] to-transparent",
    dot: "bg-[#59c493]",
    symbol: "▣",
  },
  amber: {
    label: "text-[#9a6a13]",
    icon: "bg-[#fff8e7] text-[#b77d16] ring-[#f7dfaa]",
    line: "from-[#f4c95d] via-[#ffe5a6] to-transparent",
    dot: "bg-[#f4c95d]",
    symbol: "◌",
  },
  rose: {
    label: "text-[#a1485d]",
    icon: "bg-[#fff0f4] text-[#c35670] ring-[#f3c0cd]",
    line: "from-[#e76f8a] via-[#f6b6c5] to-transparent",
    dot: "bg-[#e76f8a]",
    symbol: "!",
  },
  slate: {
    label: "text-[#365c6d]",
    icon: "bg-[#edf6f8] text-[#063048] ring-[#cfe1e9]",
    line: "from-[#063048] via-[#75c7e8] to-transparent",
    dot: "bg-[#063048]",
    symbol: "•",
  },
};

export function KpiCard({
  label,
  value,
  detail,
  accent = "indigo",
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: "indigo" | "emerald" | "amber" | "rose" | "slate";
}) {
  const style = accentStyles[accent];

  return (
    <Card className="admin-kpi-card group p-0" elevated>
      <div className={`absolute inset-x-5 top-0 h-px bg-gradient-to-r ${style.line} opacity-80`} />
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-[0.66rem] font-black uppercase tracking-[0.18em] ${style.label}`}>{label}</p>
            <p className="mt-3 truncate text-[1.9rem] font-black tracking-tight text-[#061925]">{value}</p>
          </div>
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ring-1 ${style.icon}`} aria-hidden>
            {style.symbol}
          </div>
        </div>
        {detail ? (
          <div className="mt-3 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
            <p className="truncate text-sm font-bold text-[#587080]">{detail}</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
