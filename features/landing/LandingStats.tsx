import { LandingReveal } from "./LandingReveal.client";

const STATS = [
  { value: "180+", label: "Equipos activos" },
  { value: "42", label: "Agencias partner" },
  { value: "9", label: "Países Latam" },
  { value: "$4.2M", label: "Gestionados / mes" },
] as const;

export function LandingStats() {
  return (
    <section className="border-y border-white/10 bg-[#0f0e0c] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
      <div className="mx-auto w-full max-w-[72rem]">
        <LandingReveal>
          <p className="landing-label !text-[#ff9a4a]">Holistic en números</p>
          <h2 className="font-register mt-3 max-w-[28ch] text-[clamp(1.55rem,2.5vw,2.25rem)] font-bold tracking-[-0.03em] text-white">
            Escala real para campañas con impacto en toda la región.
          </h2>
        </LandingReveal>

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-8">
          {STATS.map((stat, index) => (
            <LandingReveal key={stat.label} delayMs={40 + index * 40}>
              <p className="font-register text-[clamp(1.85rem,3vw,2.6rem)] font-bold tracking-[-0.04em] tabular-nums text-white">
                {stat.value}
              </p>
              <p className="mt-1 text-[0.875rem] text-white/55">{stat.label}</p>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
