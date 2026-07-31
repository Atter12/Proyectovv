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
    <section
      id="herramientas"
      className="scroll-mt-20 px-4 py-12 sm:scroll-mt-24 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.45rem]">
            Holistic Tools
          </p>
          <h2 className="mt-2 max-w-[24ch] text-[1.65rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.2rem] lg:text-[2.35rem]">
            Tecnología que organiza la operación y acelera el crecimiento.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-[var(--auth-text-muted)] sm:mt-4 sm:text-[16px]">
            Un stack pensado para anunciantes: menos fricción, más control y
            trazabilidad financiera real.
          </p>
        </LandingReveal>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1 scrollbar-thin sm:mt-8 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {PLATFORMS.map((name) => (
            <span
              key={name}
              className="inline-flex h-8 shrink-0 items-center rounded-full border border-[var(--auth-divider)] bg-white px-3.5 text-[12px] font-semibold text-[var(--auth-text-muted)] sm:h-9 sm:px-4 sm:text-[13px]"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:gap-5">
          {TOOLS.map((tool, index) => (
            <LandingReveal key={tool.title} delayMs={50 + index * 30}>
              <article className="auth-panel h-full rounded-[1.1rem] p-5 sm:rounded-[1.25rem] sm:p-7">
                <h3 className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.1rem]">
                  {tool.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-6 text-[var(--auth-text-muted)] sm:mt-2 sm:text-[15px] sm:leading-7">
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
