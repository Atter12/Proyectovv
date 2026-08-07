"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { LandingProductStage } from "./LandingProductStage";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Hero landing — Exquisitus splash grammar + Holistic brand.
 * Brand first, one headline, one line, CTAs, product stage with flow.
 */
export function LandingHero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8 lg:pb-28 lg:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px landing-flow-line opacity-70"
      />

      <div className="mx-auto grid w-full max-w-[72rem] items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] lg:gap-14">
        <div className="min-w-0">
          <motion.p
            className="font-register text-[clamp(1.35rem,2.4vw,1.85rem)] font-bold tracking-[-0.02em] text-[var(--landing-accent)]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
          >
            {siteConfig.name}
          </motion.p>

          <motion.h1
            className="font-register mt-3 max-w-[16ch] text-[clamp(2.15rem,calc(1rem+4.2vw),4.25rem)] font-bold tracking-[-0.03em] text-[var(--landing-ink)]"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06, ease }}
          >
            Crece con control real en ads.
          </motion.h1>

          <motion.p
            className="mt-5 max-w-[34rem] text-[1.0625rem] leading-[1.75] text-[var(--landing-body)] sm:text-[1.125rem]"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14, ease }}
          >
            Cartera, cuentas TikTok y pagos en un solo panel — para agencias y
            equipos de performance en Latam.
          </motion.p>

          <motion.div
            className="mt-8 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22, ease }}
          >
            <Link href={routes.login} className="landing-cta-primary w-full sm:w-auto">
              Entrar al panel
            </Link>
            <a href="#como-funciona" className="landing-cta-secondary w-full sm:w-auto">
              Ver cómo funciona
            </a>
          </motion.div>

          <motion.div
            className="mt-8 flex items-center gap-3"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.32, ease }}
          >
            <div className="flex shrink-0 -space-x-2" aria-hidden>
              {["MG", "RS", "VT", "DP"].map((initials) => (
                <span
                  key={initials}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white bg-[rgb(255_120_31_/_0.1)] font-register text-[10px] font-bold text-[var(--landing-accent-text)]"
                >
                  {initials}
                </span>
              ))}
            </div>
            <p className="min-w-0 text-[0.875rem] leading-snug text-[var(--landing-muted)]">
              +180 equipos en Latam ya operan con Holistic
            </p>
          </motion.div>
        </div>

        <motion.div
          className="landing-hero-stage relative min-w-0"
          initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.12, ease }}
        >
          <div className="mx-auto w-full max-w-[520px] lg:max-w-none">
            <LandingProductStage />
          </div>
          {!reduce ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-x-6 -bottom-4 h-16 opacity-40 sm:-inset-x-10"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgb(255 120 31 / 0.35), transparent 70%)",
              }}
              animate={{ opacity: [0.25, 0.45, 0.25], scale: [0.98, 1.02, 0.98] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            />
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
