import { LandingReveal } from "./LandingReveal.client";

const TOOLS = [
  {
    title: "Cartera Holistic",
    description: "Saldo disponible, recargas y asignación en un solo flujo.",
  },
  {
    title: "Cuentas publicitarias",
    description: "Conectá e importá advertisers TikTok con control por cliente.",
  },
  {
    title: "Pagos y ledger",
    description: "Historial claro de cobros, gastos ads y saldos estimados.",
  },
  {
    title: "Creative Analyzer",
    description: "Evaluá creativos con criterios de performance, no intuición.",
  },
] as const;

const PLATFORMS = ["TikTok Ads", "Hecom Club", "Stripe", "Pagos locales"] as const;

export function LandingTools() {
  return (
    <section id="herramientas" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.5rem]">
            Holistic Tools
          </p>
          <h2 className="mt-2 max-w-[24ch] text-[2rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.35rem]">
            Tecnología que organiza la operación y acelera el crecimiento.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] font-medium leading-7 text-[var(--auth-text-muted)]">
            Un stack pensado para anunciantes: menos fricción, más control y
            trazabilidad financiera real.
          </p>
        </LandingReveal>

        <div className="mt-8 flex flex-wrap gap-2">
          {PLATFORMS.map((name) => (
            <span
              key={name}
              className="inline-flex h-9 items-center rounded-full border border-[var(--auth-divider)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text-muted)]"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:gap-5">
          {TOOLS.map((tool, index) => (
            <LandingReveal key={tool.title} delayMs={60 + index * 40}>
              <article className="auth-panel h-full rounded-[1.25rem] p-6 sm:p-7">
                <h3 className="text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                  {tool.title}
                </h3>
                <p className="mt-2 text-[15px] leading-7 text-[var(--auth-text-muted)]">
                  {tool.description}
                </p>
              </article>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
