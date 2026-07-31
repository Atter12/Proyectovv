import { LandingReveal } from "./LandingReveal.client";

const STEPS = [
  {
    n: "01",
    title: "Recargar cartera",
    description: "Ingresá saldo con pasarelas locales o flujo manual revisado.",
  },
  {
    n: "02",
    title: "Asignar a cuentas ads",
    description: "Distribuí presupuesto a TikTok y cuentas activas en segundos.",
  },
  {
    n: "03",
    title: "Gastar y controlar",
    description: "Seguí cobros, gastos y saldo estimado sin salir del panel.",
  },
] as const;

export function LandingHow() {
  return (
    <section
      id="como-funciona"
      className="scroll-mt-24 border-y border-[var(--auth-divider)] bg-white/70 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.5rem]">
            Cómo funciona
          </p>
          <h2 className="mt-2 max-w-[24ch] text-[2rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.35rem]">
            Tres pasos. Misma claridad de punta a punta.
          </h2>
        </LandingReveal>

        <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {STEPS.map((step, index) => (
            <LandingReveal key={step.n} delayMs={70 + index * 50}>
              <li className="auth-panel h-full rounded-[1.25rem] p-6 sm:p-7">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[13px] font-bold text-[var(--auth-accent)]">
                  {step.n}
                </span>
                <h3 className="mt-5 text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-7 text-[var(--auth-text-muted)]">
                  {step.description}
                </p>
              </li>
            </LandingReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
