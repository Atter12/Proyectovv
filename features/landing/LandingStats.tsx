import { LandingReveal } from "./LandingReveal.client";

const STATS = [
  { value: "180+", label: "Equipos activos" },
  { value: "42", label: "Agencias partner" },
  { value: "9", label: "Países Latam" },
  { value: "$4.2M", label: "Gestionados / mes" },
] as const;

export function LandingStats() {
  return (
    <section className="border-y border-[var(--auth-divider)] bg-[var(--auth-text)] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.15rem]">
            Holistic en números
          </p>
          <h2 className="mt-2 max-w-[28ch] text-[1.55rem] font-bold leading-[1.2] tracking-[-0.03em] text-white sm:text-[2rem] lg:text-[2.15rem]">
            Escala real para campañas con impacto en toda la región.
          </h2>
        </LandingReveal>

        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:mt-10 sm:gap-6 md:grid-cols-4 md:gap-8">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-[1.85rem] font-bold tracking-[-0.04em] text-white sm:text-[2.35rem] lg:text-[2.6rem]">
                {stat.value}
              </p>
              <p className="mt-1 text-[12px] font-medium text-white/65 sm:text-[14px]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
