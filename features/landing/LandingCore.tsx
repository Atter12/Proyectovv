import { LandingReveal } from "./LandingReveal.client";

const ITEMS = [
  {
    title: "Crédito y cartera",
    description:
      "Recargá saldo, asigná presupuesto a cuentas ads y seguí cada movimiento con claridad.",
    lead: true,
  },
  {
    title: "Operación asistida",
    description:
      "Un puente entre tu equipo y la operación: clientes, cuentas y soporte en un flujo.",
  },
  {
    title: "Control financiero",
    description:
      "Historial Hecom, asignación a TikTok y visión de saldos para decidir más rápido.",
  },
  {
    title: "Soporte Latam",
    description:
      "Atención en español para Perú y la región, alineada a cómo operan las agencias locales.",
  },
] as const;

export function LandingCore() {
  const [lead, ...rest] = ITEMS;

  return (
    <section
      id="soluciones"
      className="scroll-mt-20 px-4 py-14 sm:scroll-mt-24 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[72rem]">
        <LandingReveal>
          <p className="landing-label">Soluciones</p>
          <h2 className="font-register mt-3 max-w-[22ch] text-[clamp(1.75rem,2.8vw,2.5rem)] font-bold tracking-[-0.025em] text-[var(--landing-ink)]">
            Pensado para operar, no para decorar.
          </h2>
          <p className="mt-4 max-w-[var(--landing-measure)] text-[1.0625rem] leading-[1.75] text-[var(--landing-body)]">
            Pagos, saldos, cuentas y seguimiento en un panel formal y claro —
            con el naranja Holistic donde importa.
          </p>
        </LandingReveal>

        <div className="mt-10 grid gap-4 sm:mt-12">
          {lead ? (
            <LandingReveal>
              <article className="landing-card p-6 sm:p-8">
                <p className="landing-label">Core</p>
                <h3 className="font-register mt-3 text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--landing-ink)] sm:text-[1.5rem]">
                  {lead.title}
                </h3>
                <p className="mt-3 max-w-[40rem] text-[1.0625rem] leading-[1.75] text-[var(--landing-body)]">
                  {lead.description}
                </p>
              </article>
            </LandingReveal>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            {rest.map((item, index) => (
              <LandingReveal key={item.title} delayMs={40 + index * 50}>
                <article className="landing-card h-full p-5 sm:p-6">
                  <h3 className="font-register text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--landing-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[0.98rem] leading-[1.7] text-[var(--landing-body)]">
                    {item.description}
                  </p>
                </article>
              </LandingReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
