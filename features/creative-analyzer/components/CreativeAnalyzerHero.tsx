import type { CreativeAnalyzerMetrics } from "@/types/creative-analyzer";

interface CreativeAnalyzerHeroProps {
  metrics: CreativeAnalyzerMetrics;
}

export function CreativeAnalyzerHero({ metrics }: CreativeAnalyzerHeroProps) {
  const barHeights = [40, 65, 55, 80, 70, 90, 75];

  return (
    <div className="dashboard-surface-card relative min-h-[260px] overflow-hidden rounded-2xl sm:min-h-[300px] lg:min-h-[340px]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#ff781f,#ffa12c)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--auth-accent)]/[0.08] blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col gap-6 p-5 pl-6 sm:gap-8 sm:p-7 sm:pl-8 lg:flex-row lg:items-center lg:justify-between lg:p-8 lg:pl-9">
        <div className="min-w-0 max-w-xl">
          <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
            Análisis creativo
          </p>
          <h2 className="mt-2 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2rem] lg:text-[2.35rem]">
            Analizador creativo
          </h2>
          <p className="mt-3 max-w-lg text-[15px] font-medium leading-7 text-[var(--auth-text-muted)]">
            Analiza, puntúa y mejora piezas creativas con señales reales de
            campaña antes de escalar presupuesto.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a
              href="#creative-benchmark"
              className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.28)] transition-[filter] hover:brightness-[1.05]"
            >
              Analiza tu primer video
            </a>
            <a
              href="#creative-workflow"
              className="inline-flex h-11 items-center rounded-xl border border-[var(--auth-control-border)] bg-white px-5 text-[14px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>

        <div className="min-w-0 w-full max-w-sm shrink-0 lg:max-w-md">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9a9187]">
                  Puntuación creativa
                </p>
                <p className="mt-1 font-display text-3xl font-medium text-[#141210]">
                  {metrics.averageScore}
                  <span className="text-lg font-medium text-[#9a9187]">/100</span>
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Señal ganadora
                </span>
                <span className="rounded-full bg-[var(--brand-primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-primary-deep)]">
                  Cumple políticas
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
                  className="rounded-lg border border-[var(--border-subtle)] bg-white px-2 py-2 text-center"
                >
                  <p className="text-[9px] uppercase tracking-wide text-[#9a9187]">
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#141210]">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex h-12 items-end gap-1">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-[var(--brand-primary)]"
                  style={{ height: `${h}%`, opacity: 0.4 + i * 0.07 }}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {["GANCHO", "RETENCIÓN", "CTA"].map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-[var(--border-subtle)] bg-white px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#6b645c]"
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
