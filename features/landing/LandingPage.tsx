import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";
import { LandingProductStage } from "./LandingProductStage";
import { LandingReveal } from "./LandingReveal.client";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f3efe9] text-[#1a1612]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Saltar al contenido
      </a>

      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link href={routes.home} className="flex items-center gap-2.5" aria-label={siteConfig.name}>
          <HolisticLogo size={36} className="h-8 w-auto sm:h-9" />
          <span className="hidden text-[14px] font-semibold tracking-[-0.02em] text-[#1a1612] sm:inline">
            {siteConfig.name}
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px]">
          <Link
            href={routes.login}
            className="font-medium text-[#5c564e] underline-offset-4 transition-colors hover:text-[#1a1612] hover:underline"
          >
            Entrar
          </Link>
          <Link
            href={routes.register}
            className="inline-flex h-10 items-center rounded-lg bg-[#e85a1c] px-4 font-medium text-white transition-colors hover:bg-[#d14e16]"
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main id="contenido">
        {/* Hero: brand left + live product right */}
        <section className="relative overflow-hidden border-b border-[rgb(20_18_16_/_0.08)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_0%,rgb(255_120_31_/_0.12),transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_20%,rgb(255_161_44_/_0.08),transparent_50%)]"
          />
          <div className="relative mx-auto grid max-w-[1180px] gap-10 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-end lg:gap-12 lg:px-10 lg:pb-16 lg:pt-8">
            <LandingReveal className="max-w-xl pb-2 lg:pb-8">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8a5a38]">
                Panel del anunciante
              </p>
              <h1 className="mt-4 text-[2.35rem] font-semibold leading-[1.05] tracking-[-0.035em] text-[#1a1612] sm:text-[2.85rem] lg:text-[3.15rem]">
                Holistic Marketing
              </h1>
              <p className="mt-4 max-w-md text-[16px] leading-7 text-[#5c564e]">
                Recargás la cartera, asignás a cuentas TikTok y las campañas
                gastan. Una sola operación — sin pagar campaña por campaña.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={routes.register}
                  className="inline-flex h-12 items-center rounded-lg bg-[#e85a1c] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[#d14e16]"
                >
                  Empezar
                </Link>
                <Link
                  href={routes.login}
                  className="text-[14px] font-medium text-[#5c564e] underline-offset-4 hover:text-[#1a1612] hover:underline"
                >
                  Ya tengo cuenta
                </Link>
              </div>
            </LandingReveal>

            <LandingReveal delayMs={120} className="min-w-0">
              <LandingProductStage />
            </LandingReveal>
          </div>
        </section>

        {/* Flow — definition list, not cards */}
        <section className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
          <LandingReveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8a5a38]">
              Cómo se mueve la plata
            </p>
            <h2 className="mt-3 max-w-lg text-[1.65rem] font-semibold tracking-[-0.025em] text-[#1a1612] sm:text-[1.9rem]">
              Tres pasos. El resto es historial.
            </h2>
          </LandingReveal>

          <dl className="mt-10 grid gap-8 border-t border-[rgb(20_18_16_/_0.1)] pt-10 sm:grid-cols-3 sm:gap-6 lg:gap-10">
            {[
              {
                n: "01",
                title: "Recargar",
                text: "Metés plata a la cartera Holistic (Stripe, transferencia o cripto).",
              },
              {
                n: "02",
                title: "Asignar",
                text: "Pasás saldo a la cuenta TikTok del cliente activo.",
              },
              {
                n: "03",
                title: "Gastar",
                text: "Las campañas consumen de esa cuenta. Abajo solo ves lo ya cobrado.",
              },
            ].map((step, i) => (
              <LandingReveal key={step.n} delayMs={80 + i * 70}>
                <div className="relative">
                  <dt className="flex items-baseline gap-3">
                    <span className="font-mono text-[13px] tabular-nums text-[#c45a18]">
                      {step.n}
                    </span>
                    <span className="text-[17px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                      {step.title}
                    </span>
                  </dt>
                  <dd className="mt-3 text-[14px] leading-6 text-[#5c564e]">
                    {step.text}
                  </dd>
                </div>
              </LandingReveal>
            ))}
          </dl>
        </section>

        {/* One job: scope */}
        <section className="border-y border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
          <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:px-10 lg:py-16">
            <LandingReveal className="max-w-xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8a5a38]">
                Cliente activo
              </p>
              <h2 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.025em] text-[#1a1612] sm:text-[1.75rem]">
                Cada vista es de un cliente: cuentas, cobros, gastos y creativos.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-[#5c564e]">
                Conectado a Hecom Club. El anunciante ve lo suyo; la agencia
                opera con control real de cartera y asignación.
              </p>
            </LandingReveal>
            <LandingReveal delayMs={100} className="mt-8 lg:mt-0 lg:shrink-0">
              <p className="text-[13px] leading-6 text-[#7a736a]">
                Recargás arriba para fondear;
                <br />
                abajo solo ves el historial de lo ya cobrado y gastado.
              </p>
            </LandingReveal>
          </div>
        </section>

        {/* Close CTA */}
        <section className="mx-auto max-w-[1180px] px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
          <LandingReveal className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[1.55rem] font-semibold tracking-[-0.025em] text-[#1a1612] sm:text-[1.75rem]">
                Listo para operar.
              </h2>
              <p className="mt-2 text-[15px] text-[#5c564e]">
                Entrá al panel y empezá con tu cliente activo.
              </p>
            </div>
            <Link
              href={routes.register}
              className="inline-flex h-12 shrink-0 items-center rounded-lg bg-[#1a1612] px-6 text-[15px] font-semibold text-[#faf7f3] transition-colors hover:bg-[#2a241f]"
            >
              Crear cuenta
            </Link>
          </LandingReveal>
        </section>
      </main>

      <footer className="border-t border-[rgb(20_18_16_/_0.08)] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 text-[12px] text-[#7a736a]">
          <p>© {new Date().getFullYear()} {siteConfig.companyName}</p>
          <Link href={routes.login} className="hover:text-[#1a1612]">
            Acceso al panel
          </Link>
        </div>
      </footer>
    </div>
  );
}
