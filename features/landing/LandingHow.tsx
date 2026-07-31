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
      className="scroll-mt-20 border-y border-[var(--auth-divider)] bg-white/70 px-4 py-12 sm:scroll-mt-24 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.45rem]">
            Cómo funciona
          </p>
          <h2 className="mt-2 max-w-[24ch] text-[1.65rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.2rem] lg:text-[2.35rem]">
            Tres pasos. Misma claridad de punta a punta.
          </h2>
        </LandingReveal>

        <ol className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 md:grid-cols-3 md:gap-5">
          {STEPS.map((step, index) => (
            <LandingReveal key={step.n} delayMs={50 + index * 40}>
              <li className="auth-panel flex h-full gap-4 rounded-[1.1rem] p-5 sm:block sm:rounded-[1.25rem] sm:p-7">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[12px] font-bold text-[var(--auth-accent)] sm:h-11 sm:w-11 sm:text-[13px]">
                  {step.n}
                </span>
                <div>
                  <h3 className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)] sm:mt-5 sm:text-[1.15rem]">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-[14px] leading-6 text-[var(--auth-text-muted)] sm:mt-2 sm:text-[15px] sm:leading-7">
                    {step.description}
                  </p>
                </div>
              </li>
            </LandingReveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
