import type { CreativeAnalyzerMetrics } from "@/types/creative-analyzer";

interface CreativeAnalyzerHeroProps {
  metrics: CreativeAnalyzerMetrics;
}

export function CreativeAnalyzerHero({ metrics }: CreativeAnalyzerHeroProps) {
  const barHeights = [40, 65, 55, 80, 70, 90, 75];

  return (
    <div className="relative min-h-[260px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#070b1f] via-[#0f172a] to-[#1e1b4b] shadow-xl shadow-indigo-950/20 sm:min-h-[300px] sm:rounded-3xl lg:min-h-[360px]">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#4056ff]/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#06b6d4]/15 blur-3xl" />
        <div className="absolute right-1/4 top-1/2 h-px w-48 rotate-12 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 p-5 sm:gap-8 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:p-10">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90 backdrop-blur-sm">
            AI Creative Director
          </span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2.5rem] lg:leading-tight">
            Creative Analyzer
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            Analyze, score &amp; generate new creatives from real campaign
            signals.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#creative-benchmark"
              className="inline-flex h-11 items-center rounded-xl bg-[#4056ff] px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#4056ff]/90"
            >
              Analyze your first video
            </a>
            <a
              href="#creative-workflow"
              className="inline-flex h-11 items-center rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/15"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>

        <div className="min-w-0 w-full max-w-sm shrink-0 lg:max-w-md">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/50">
                  Creative Score
                </p>
                <p className="mt-1 text-3xl font-bold text-white">
                  {metrics.averageScore}
                  <span className="text-lg font-medium text-white/50">/100</span>
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Winner signal
                </span>
                <span className="rounded-full bg-[#4056ff]/30 px-2 py-0.5 text-[10px] font-semibold text-blue-200">
                  Policy safe
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: "CTR", value: "2.4%" },
                { label: "CPA", value: "$6.80" },
                { label: metrics.topMetric, value: "3.8x" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center"
                >
                  <p className="text-[9px] uppercase tracking-wide text-white/45">
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-white">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex h-12 items-end gap-1">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-[#4056ff] to-[#06b6d4]"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {["HOOK", "RETENTION", "CTA"].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-white/60"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
