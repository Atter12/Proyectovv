import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { HolisticLogo } from "@/components/brand/EcomdyLogo";
import { LandingProductStage } from "./LandingProductStage";
import { LandingProof } from "./LandingProof.client";
import { LandingReveal } from "./LandingReveal.client";

const FEATURES = [
  {
    title: "Cartera y saldos",
    description: "Asigná presupuesto a cuentas publicitarias en un solo flujo.",
  },
  {
    title: "Pagos integrados",
    description: "Stripe, Culqi, Mercado Pago, cripto o transferencia revisada.",
  },
  {
    title: "Operación Latam",
    description: "Panel en español para agencias y equipos de performance.",
  },
] as const;

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
        <Link
          href={routes.home}
          className="flex items-center gap-2.5"
          aria-label={siteConfig.name}
        >
          <HolisticLogo size={40} className="h-9 w-auto sm:h-10" />
          <span className="hidden text-[15px] font-semibold tracking-[-0.02em] text-[#1a1612] sm:inline">
            <span className="text-[#e85a1c]">holistic</span> marketing
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-[13px] sm:gap-5">
          <Link
            href={routes.login}
            className="font-semibold text-[#5c564e] underline-offset-4 transition-colors hover:text-[#1a1612] hover:underline"
          >
            Entrar
          </Link>
          <Link
            href={routes.register}
            className="inline-flex h-10 items-center rounded-lg bg-[#e85a1c] px-4 font-semibold text-white shadow-[0_8px_18px_rgb(232_90_28_/_0.22)] transition-colors hover:bg-[#d14e16]"
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main id="contenido">
        <section className="relative overflow-hidden border-b border-[rgb(20_18_16_/_0.08)]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_8%_0%,rgb(255_120_31_/_0.14),transparent_55%),radial-gradient(ellipse_50%_40%_at_92%_18%,rgb(255_161_44_/_0.09),transparent_50%),linear-gradient(180deg,rgb(255_252_248_/_0.55),transparent_42%)]"
          />
          <div className="relative mx-auto grid max-w-[1180px] gap-10 px-5 pb-14 pt-4 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-end lg:gap-12 lg:px-10 lg:pb-16 lg:pt-6">
            <LandingReveal className="max-w-xl pb-2 lg:pb-10">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#c45a18]">
                Panel del anunciante
              </p>
              <h1 className="mt-4 text-[2.45rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[#1a1612] sm:text-[3rem] lg:text-[3.25rem]">
                Holistic Marketing
              </h1>
              <p className="mt-4 max-w-md text-[16px] leading-7 text-[#5c564e] sm:text-[17px]">
                Opera campañas, pagos y saldos en un solo lugar. Recargás la
                cartera, asignás a TikTok y las campañas gastan — sin pagar
                campaña por campaña.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={routes.register}
                  className="inline-flex h-12 items-center rounded-lg bg-[#e85a1c] px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_rgb(232_90_28_/_0.28)] transition-colors hover:bg-[#d14e16]"
                >
                  Empezar
                </Link>
                <Link
                  href={routes.login}
                  className="text-[14px] font-semibold text-[#5c564e] underline-offset-4 hover:text-[#1a1612] hover:underline"
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

        <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
          <LandingReveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#c45a18]">
              Por qué Holistic
            </p>
            <h2 className="mt-3 max-w-xl text-[1.65rem] font-semibold tracking-[-0.03em] text-[#1a1612] sm:text-[1.9rem]">
              Control real — no otra dashboard genérica.
            </h2>
          </LandingReveal>

          <ul className="mt-10 grid gap-8 border-t border-[rgb(20_18_16_/_0.1)] pt-10 sm:grid-cols-3 sm:gap-8">
            {FEATURES.map((feature, i) => (
              <LandingReveal key={feature.title} delayMs={70 + i * 70}>
                <li className="flex gap-3.5">
                  <span
                    className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#e85a1c] shadow-[0_0_12px_rgb(255_120_31_/_0.45)]"
                    aria-hidden
                  />
                  <div>
                    <p className="text-[16px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                      {feature.title}
                    </p>
                    <p className="mt-1.5 text-[14px] leading-6 text-[#5c564e]">
                      {feature.description}
                    </p>
                  </div>
                </li>
              </LandingReveal>
            ))}
          </ul>
        </section>

        <section className="border-y border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8]">
          <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
            <LandingReveal>
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#c45a18]">
                Cómo se mueve la plata
              </p>
              <h2 className="mt-3 max-w-lg text-[1.65rem] font-semibold tracking-[-0.03em] text-[#1a1612] sm:text-[1.9rem]">
                Tres pasos. El resto es historial.
              </h2>
            </LandingReveal>

            <dl className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6 lg:gap-10">
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
                  <div>
                    <dt className="flex items-baseline gap-3">
                      <span className="font-mono text-[13px] font-semibold tabular-nums text-[#c45a18]">
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
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-14">
            <LandingReveal className="max-w-xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#c45a18]">
                Cliente activo
              </p>
              <h2 className="mt-3 text-[1.55rem] font-semibold tracking-[-0.03em] text-[#1a1612] sm:text-[1.75rem]">
                Cada vista es de un cliente: cuentas, cobros, gastos y creativos.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-[#5c564e]">
                Conectado a Hecom Club. El anunciante ve lo suyo; la agencia
                opera con control real de cartera y asignación.
              </p>
            </LandingReveal>
            <LandingReveal delayMs={100}>
              <LandingProof />
            </LandingReveal>
          </div>
        </section>

        {/* CTA — lenguaje del login (canvas oscuro cálido) */}
        <section className="relative overflow-hidden border-t border-[rgb(20_18_16_/_0.1)]">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(980px_520px_at_8%_0%,rgb(255_120_31_/_0.22),transparent_58%),radial-gradient(720px_480px_at_90%_80%,rgb(255_77_45_/_0.1),transparent_55%),linear-gradient(165deg,#1a1612_0%,#16130f_50%,#1c1814_100%)]"
          />
          <div className="relative mx-auto flex max-w-[1180px] flex-col gap-8 px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-20">
            <LandingReveal className="max-w-xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#ff781f]">
                Acceso al panel
              </p>
              <h2 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.03em] text-[#faf7f2] sm:text-[2rem]">
                Listo para operar.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-[#e0d5c8]">
                Entrá con el mismo diseño que ya conocés en login. Empezá con
                tu cliente activo y fondeá desde la cartera.
              </p>
            </LandingReveal>
            <LandingReveal
              delayMs={90}
              className="flex flex-wrap items-center gap-3"
            >
              <Link
                href={routes.login}
                className="inline-flex h-12 items-center rounded-xl bg-[#ff781f] px-6 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgb(255_120_31_/_0.35)] transition-colors hover:bg-[#e8451a]"
              >
                Iniciar sesión
              </Link>
              <Link
                href={routes.register}
                className="inline-flex h-12 items-center rounded-xl border border-white/15 bg-white/[0.04] px-6 text-[15px] font-semibold text-[#faf7f2] transition-colors hover:bg-white/[0.08]"
              >
                Crear cuenta
              </Link>
            </LandingReveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgb(20_18_16_/_0.08)] bg-[#f3efe9] px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 text-[12px] text-[#7a736a]">
          <p>
            © {new Date().getFullYear()} {siteConfig.companyName}
          </p>
          <div className="flex items-center gap-4">
            <Link href={routes.login} className="font-medium hover:text-[#1a1612]">
              Acceso al panel
            </Link>
            <Link
              href={routes.register}
              className="font-medium hover:text-[#1a1612]"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
