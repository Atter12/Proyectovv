import Link from "next/link";
import { routes } from "@/config/routes";
import { LandingProductStage } from "./LandingProductStage";
import { LandingReveal } from "./LandingReveal.client";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16 lg:px-8 lg:pb-24 lg:pt-20">
      <div className="mx-auto grid w-full max-w-[1180px] items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <LandingReveal>
          <p className="text-[1.25rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.4rem]">
            Holistic Marketing
          </p>
          <h1 className="mt-3 max-w-[18ch] text-[2.6rem] font-bold leading-[1.12] tracking-[-0.04em] text-[var(--auth-text)] sm:text-[3.15rem] xl:text-[3.45rem]">
            Opera campañas, pagos y saldos en un solo lugar.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] font-medium leading-8 text-[var(--auth-text-muted)]">
            Recargá la cartera, asigná a cuentas TikTok y controlá la operación
            publicitaria sin planillas ni dashboards genéricos.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={routes.register}
              className="inline-flex h-12 items-center rounded-xl bg-[var(--auth-accent)] px-6 text-[15px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
            >
              Crear cuenta gratis
            </Link>
            <Link
              href={routes.login}
              className="inline-flex h-12 items-center rounded-xl border border-[var(--auth-control-border)] bg-white px-6 text-[15px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
            >
              Iniciar sesión
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex -space-x-2">
              {["MG", "RS", "VT", "DP", "CR"].map((initials) => (
                <span
                  key={initials}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--auth-accent-soft)] text-[10px] font-bold text-[var(--auth-accent)]"
                >
                  {initials}
                </span>
              ))}
            </div>
            <p className="text-[13px] font-semibold text-[var(--auth-text-muted)]">
              +180 equipos en Latam ya operan con Holistic
            </p>
          </div>
        </LandingReveal>

        <LandingReveal delayMs={120}>
          <LandingProductStage />
        </LandingReveal>
      </div>
    </section>
  );
}
