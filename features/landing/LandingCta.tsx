import Link from "next/link";
import { routes } from "@/config/routes";
import { LandingReveal } from "./LandingReveal.client";

export function LandingCta() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
      <LandingReveal>
        <div className="mx-auto flex w-full max-w-[72rem] flex-col gap-6 overflow-hidden rounded-[0.75rem] border border-[var(--landing-hairline)] bg-[#0f0e0c] px-5 py-9 sm:gap-8 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="landing-label !text-[#ff9a4a]">Empezá hoy</p>
            <h2 className="font-register mt-3 text-[clamp(1.55rem,2.4vw,2.15rem)] font-bold tracking-[-0.03em] text-white">
              Entrá al panel y publicá con control real.
            </h2>
            <p className="mt-3 text-[1.02rem] leading-[1.7] text-white/65">
              Unite a +180 equipos que ya centralizan cartera, cuentas ads y
              pagos.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3">
            <Link
              href={routes.login}
              className="landing-cta-primary w-full sm:w-auto"
            >
              Entrar con email
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-white/20 bg-transparent px-5 font-register text-[0.9375rem] font-bold text-white transition-colors hover:bg-white/8 sm:w-auto"
            >
              Ver el flujo
            </a>
          </div>
        </div>
      </LandingReveal>
    </section>
  );
}
