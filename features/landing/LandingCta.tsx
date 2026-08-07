import Link from "next/link";
import { routes } from "@/config/routes";
import { LandingReveal } from "./LandingReveal.client";

export function LandingCta() {
  return (
    <section className="px-4 pb-12 sm:px-6 sm:pb-16 lg:px-8 lg:pb-20">
      <LandingReveal>
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 overflow-hidden rounded-[1.25rem] bg-[var(--auth-text)] px-5 py-8 sm:gap-8 sm:rounded-[1.5rem] sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[1rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.1rem]">
              Empezá hoy
            </p>
            <h2 className="mt-2 text-[1.55rem] font-bold leading-[1.2] tracking-[-0.03em] text-white sm:text-[2rem] lg:text-[2.15rem]">
              Creá tu cuenta y publicá con control real.
            </h2>
            <p className="mt-3 text-[14px] font-medium leading-6 text-white/70 sm:text-[15px] sm:leading-7">
              Unite a +180 equipos que ya centralizan cartera, cuentas ads y pagos.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              href={routes.register}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[var(--auth-accent)] px-6 text-[15px] font-bold text-white transition-[filter] hover:brightness-[1.05] sm:w-auto"
            >
              Crear cuenta
            </Link>
            <Link
              href={routes.login}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}
