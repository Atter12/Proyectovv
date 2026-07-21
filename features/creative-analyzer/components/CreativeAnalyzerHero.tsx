import type { CreativeAnalyzerMetrics } from "@/types/creative-analyzer";

interface CreativeAnalyzerHeroProps {
  metrics: CreativeAnalyzerMetrics;
}

export function CreativeAnalyzerHero({ metrics }: CreativeAnalyzerHeroProps) {
  const barHeights = [40, 65, 55, 80, 70, 90, 75];

  return (
    <div className="relative min-h-[260px] overflow-hidden rounded-2xl bg-[linear-gradient(145deg,#07111f_0%,#0c2748_48%,#0b4f9c_100%)] shadow-[0_18px_40px_rgb(7_17_31_/_0.35)] sm:min-h-[300px] lg:min-h-[340px]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.45) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse 65% 75% at 78% 30%, black, transparent)",
          }}
        />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--brand-primary)]/30 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#9af7c9]/12 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 p-5 sm:gap-8 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div className="min-w-0 max-w-xl">
          <p className="text-[13px] font-semibold tracking-[0.04em] text-[var(--brand-mint)]">
            Análisis creativo
          </p>
          <h2 className="font-display mt-2 text-[1.75rem] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[2rem] lg:text-[2.35rem]">
            Analizador creativo
          </h2>
          <p className="mt-3 max-w-lg text-[15px] leading-7 text-white/80">
            Analiza, puntúa y mejora piezas creativas con señales reales de
            campaña antes de escalar presupuesto.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#creative-benchmark"
              className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-[0_10px_24px_rgb(23_139_255_/_0.3)] transition-colors hover:bg-[var(--brand-primary-deep)]"
            >
              Analiza tu primer video
            </a>
            <a
              href="#creative-workflow"
              className="inline-flex h-11 items-center rounded-xl border border-white/20 bg-white/10 px-5 text-[14px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              Ver cómo funciona
            </a>
          </div>
        </div>

        <div className="min-w-0 w-full max-w-sm shrink-0 lg:max-w-md">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
                  Puntuación creativa
                </p>
                <p className="mt-1 font-display text-3xl font-medium text-white">
                  {metrics.averageScore}
                  <span className="text-lg font-medium text-white/50">/100</span>
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                  Señal ganadora
                </span>
                <span className="rounded-full bg-[var(--brand-primary)]/30 px-2 py-0.5 text-[10px] font-semibold text-[#b7d9ff]">
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
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center"
                >
                  <p className="text-[9px] uppercase tracking-wide text-white/45">
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex h-12 items-end gap-1">
              {barHeights.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-[var(--brand-primary)]"
                  style={{ height: `${h}%`, opacity: 0.45 + i * 0.07 }}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {["GANCHO", "RETENCIÓN", "CTA"].map((tag) => (
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
