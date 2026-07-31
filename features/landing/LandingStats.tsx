import { LandingReveal } from "./LandingReveal.client";

const STATS = [
  { value: "1", label: "Panel para operar" },
  { value: "3", label: "Pasos del flujo" },
  { value: "24/7", label: "Acceso al dashboard" },
  { value: "Latam", label: "Enfoque regional" },
] as const;

export function LandingStats() {
  return (
    <section className="border-y border-[var(--auth-divider)] bg-[var(--auth-text)] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
            Holistic en números
          </p>
          <h2 className="mt-2 max-w-[28ch] text-[1.85rem] font-bold leading-[1.2] tracking-[-0.03em] text-white sm:text-[2.15rem]">
            Potencia campañas con impacto y escala operativa.
          </h2>
        </LandingReveal>

        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <p className="text-[2.2rem] font-bold tracking-[-0.04em] text-white sm:text-[2.6rem]">
                {stat.value}
              </p>
              <p className="mt-1 text-[14px] font-medium text-white/65">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
