import { Card } from "@/components/ui/Card";

export function KpiCard({ label, value, detail, accent = "indigo" }: { label: string; value: string; detail?: string; accent?: "indigo" | "emerald" | "amber" | "rose" | "slate" }) {
  const accentClass = {
    indigo: "bg-[#0e7490]",
    emerald: "bg-[#9af7c9]",
    amber: "bg-[#f6d58f]",
    rose: "bg-[#f3a8b8]",
    slate: "bg-[#063048]",
  }[accent];

  return (
    <Card className="group relative overflow-hidden p-5" elevated>
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#0e7490,#9af7c9)] opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#789bad]">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-[#061925]">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-2xl ${accentClass} shadow-lg opacity-90`} />
      </div>
      {detail ? <p className="mt-2 text-sm font-bold text-[#5d7280]">{detail}</p> : null}
    </Card>
  );
}
