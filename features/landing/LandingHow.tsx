"use client";

import { motion, useReducedMotion } from "motion/react";
import { LandingReveal } from "./LandingReveal.client";

const STEPS = [
  {
    n: "01",
    title: "Recargar cartera",
    description: "Ingresá saldo con Stripe, pasarelas locales o flujo manual revisado.",
  },
  {
    n: "02",
    title: "Asignar a cuentas ads",
    description: "Distribuí presupuesto a TikTok y advertisers aprobados en segundos.",
  },
  {
    n: "03",
    title: "Gastar y controlar",
    description: "Seguí cobros, gastos y saldo estimado sin salir del panel.",
  },
] as const;

export function LandingHow() {
  const reduce = useReducedMotion();

  return (
    <section
      id="como-funciona"
      className="scroll-mt-20 border-y border-[var(--landing-hairline)] bg-white px-4 py-14 sm:scroll-mt-24 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[72rem]">
        <LandingReveal>
          <p className="landing-label">Cómo funciona</p>
          <h2 className="font-register mt-3 max-w-[24ch] text-[clamp(1.75rem,2.8vw,2.5rem)] font-bold tracking-[-0.025em] text-[var(--landing-ink)]">
            Tres pasos. Misma claridad de punta a punta.
          </h2>
        </LandingReveal>

        <ol className="relative mt-10 grid gap-4 sm:mt-12 md:grid-cols-3 md:gap-5">
          {!reduce ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-[8%] right-[8%] top-[2.1rem] hidden h-px md:block"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgb(255 120 31 / 0.45), transparent)",
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}

          {STEPS.map((step, index) => (
            <LandingReveal key={step.n} delayMs={60 + index * 70}>
              <li className="landing-card relative flex h-full gap-4 p-5 sm:block sm:p-7">
                <span className="font-register inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[rgb(255_120_31_/_0.1)] text-[0.8125rem] font-bold tabular-nums text-[var(--landing-accent-text)] sm:h-11 sm:w-11">
                  {step.n}
                </span>
                <div>
                  <h3 className="font-register text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--landing-ink)] sm:mt-5">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.98rem] leading-[1.7] text-[var(--landing-body)]">
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
