import { Card } from "@/components/ui/Card";
import type { AnalyzerStat } from "@/types/creative-analyzer";

interface AnalyzerStatsGridProps {
  stats: AnalyzerStat[];
}

export function AnalyzerStatsGrid({ stats }: AnalyzerStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.id}>
          <p className="text-xs font-medium text-slate-500">{stat.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</p>
        </Card>
      ))}
    </div>
  );
}
