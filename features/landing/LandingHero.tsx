import Link from "next/link";
import { routes } from "@/config/routes";
import { LandingProductStage } from "./LandingProductStage";
import { LandingReveal } from "./LandingReveal.client";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-14 lg:px-8 lg:pb-24 lg:pt-20">
      <div className="mx-auto grid w-full max-w-[1180px] items-center gap-8 sm:gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <LandingReveal>
          <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.35rem]">
            Holistic Marketing
          </p>
          <h1 className="mt-2.5 max-w-[18ch] text-[2.05rem] font-bold leading-[1.15] tracking-[-0.035em] text-[var(--auth-text)] sm:mt-3 sm:text-[2.85rem] sm:leading-[1.12] xl:text-[3.45rem]">
            Opera campañas, pagos y saldos en un solo lugar.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] font-medium leading-7 text-[var(--auth-text-muted)] sm:mt-5 sm:text-[17px] sm:leading-8">
            Recargá la cartera, asigná a cuentas TikTok y controlá la operación
            publicitaria sin planillas ni dashboards genéricos.
          </p>

          <div className="mt-6 flex w-full flex-col gap-2.5 sm:mt-8 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link
              href={routes.register}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] px-6 text-[15px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px sm:w-auto"
            >
              Crear cuenta gratis
            </Link>
            <Link
              href={routes.login}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-[var(--auth-control-border)] bg-white px-6 text-[15px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)] sm:w-auto"
            >
              Iniciar sesión
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-3 sm:mt-7">
            <div className="flex shrink-0 -space-x-2">
              {["MG", "RS", "VT", "DP", "CR"].map((initials) => (
                <span
                  key={initials}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--auth-accent-soft)] text-[9px] font-bold text-[var(--auth-accent)] sm:h-8 sm:w-8 sm:text-[10px]"
                >
                  {initials}
                </span>
              ))}
            </div>
            <p className="min-w-0 text-[12px] font-semibold leading-snug text-[var(--auth-text-muted)] sm:text-[13px]">
              +180 equipos en Latam ya operan con Holistic
            </p>
          </div>
        </LandingReveal>

        <LandingReveal delayMs={120} className="min-w-0">
          <div className="mx-auto w-full max-w-[520px] lg:max-w-none">
            <LandingProductStage />
          </div>
        </LandingReveal>
      </div>
    </section>
  );
}
