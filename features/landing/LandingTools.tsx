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
      className="scroll-mt-20 px-4 py-14 sm:scroll-mt-24 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[72rem]">
        <LandingReveal>
          <p className="landing-label">Herramientas</p>
          <h2 className="font-register mt-3 max-w-[24ch] text-[clamp(1.75rem,2.8vw,2.5rem)] font-bold tracking-[-0.025em] text-[var(--landing-ink)]">
            Tecnología que organiza la operación.
          </h2>
          <p className="mt-4 max-w-[var(--landing-measure)] text-[1.0625rem] leading-[1.75] text-[var(--landing-body)]">
            Un stack pensado para anunciantes: menos fricción, más control y
            trazabilidad financiera real.
          </p>
        </LandingReveal>

        <div className="mt-7 flex gap-2 overflow-x-auto pb-1 sm:mt-8 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {PLATFORMS.map((name) => (
            <span
              key={name}
              className="font-register inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--landing-hairline)] bg-white px-3.5 text-[0.8125rem] font-medium text-[var(--landing-muted)] sm:h-9"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2">
          {TOOLS.map((tool, index) => (
            <LandingReveal key={tool.title} delayMs={50 + index * 40}>
              <article className="landing-card h-full p-5 sm:p-7">
                <h3 className="font-register text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--landing-ink)]">
                  {tool.title}
                </h3>
                <p className="mt-2 text-[0.98rem] leading-[1.7] text-[var(--landing-body)]">
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
