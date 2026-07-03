import { Card } from "@/components/ui/Card";
import type { CreativeAnalyzerMetrics, CreativeSignal } from "@/types/creative-analyzer";

interface CreativeBenchmarkPanelProps {
  metrics: CreativeAnalyzerMetrics;
  signals: CreativeSignal[];
  recommendation: string;
}

export function CreativeBenchmarkPanel({
  metrics,
  signals,
  recommendation,
}: CreativeBenchmarkPanelProps) {
  return (
    <section id="creative-benchmark" className="scroll-mt-24">
      <Card className="overflow-hidden p-0">
        <div className="border-b border-[#e5e7eb] bg-gradient-to-r from-slate-50 to-white px-6 py-4">
          <h2 className="text-base font-semibold text-[#0f172a]">
            Creative performance snapshot
          </h2>
          <p className="mt-0.5 text-sm text-[#64748b]">
            Señales mock basadas en patrones de alto rendimiento
          </p>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
          <div className="min-w-0 p-4 sm:p-6">
            <div className="mb-6 flex flex-wrap items-end gap-2 sm:gap-3">
              <p className="text-3xl font-bold tracking-tight text-[#0f172a] sm:text-4xl">
                {metrics.averageScore}
                <span className="text-xl font-medium text-[#64748b]">/100</span>
              </p>
              <span className="mb-1 rounded-full bg-[#4056ff]/10 px-2.5 py-0.5 text-xs font-semibold text-[#4056ff]">
                Overall score
              </span>
            </div>

            <div className="space-y-4">
              {signals.map((signal) => (
                <div key={signal.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-[#0f172a]">
                      {signal.label}
                    </span>
                    <span className="font-bold text-[#4056ff]">
                      {signal.score}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#4056ff] to-[#06b6d4] transition-all duration-500"
                      style={{ width: `${signal.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-[#e5e7eb] bg-gradient-to-br from-[#070b1f] to-[#1e1b4b] p-6 text-white lg:border-l lg:border-t-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Recommended action
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/90">
              {recommendation}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["HOOK", "RETENTION", "CTA"].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}
