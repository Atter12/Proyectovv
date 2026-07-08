import { Card } from "@/components/ui/Card";

export function KpiCard({ label, value, detail, accent = "indigo" }: { label: string; value: string; detail?: string; accent?: "indigo" | "emerald" | "amber" | "rose" | "slate" }) {
  const accentClass = {
    indigo: "from-indigo-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-400 to-orange-500",
    rose: "from-rose-500 to-pink-500",
    slate: "from-slate-700 to-slate-950",
  }[accent];

  return (
    <Card className="relative overflow-hidden p-5">
      <div className={`absolute right-4 top-4 h-12 w-12 rounded-2xl bg-gradient-to-br ${accentClass} opacity-10`} />
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      {detail ? <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p> : null}
    </Card>
  );
}
