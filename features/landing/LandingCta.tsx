import Link from "next/link";
import { routes } from "@/config/routes";
import { LandingReveal } from "./LandingReveal.client";

export function LandingCta() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
      <LandingReveal>
        <div className="mx-auto flex w-full max-w-[1180px] flex-col items-start justify-between gap-8 overflow-hidden rounded-[1.5rem] bg-[var(--auth-text)] px-7 py-10 sm:flex-row sm:items-center sm:px-10 sm:py-12">
          <div className="max-w-xl">
            <p className="text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
              Empezá hoy
            </p>
            <h2 className="mt-2 text-[1.85rem] font-bold leading-[1.2] tracking-[-0.03em] text-white sm:text-[2.15rem]">
              Creá tu cuenta y publicá con control real.
            </h2>
            <p className="mt-3 text-[15px] font-medium leading-7 text-white/70">
              Cartera, cuentas ads y pagos en un solo panel formal para tu equipo.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={routes.register}
              className="inline-flex h-12 items-center rounded-xl bg-[var(--auth-accent)] px-6 text-[15px] font-bold text-white transition-[filter] hover:brightness-[1.05]"
            >
              Crear cuenta
            </Link>
            <Link
              href={routes.login}
              className="inline-flex h-12 items-center rounded-xl border border-white/15 bg-white/5 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}
