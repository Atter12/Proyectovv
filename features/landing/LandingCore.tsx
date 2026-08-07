import { LandingReveal } from "./LandingReveal.client";

const ITEMS = [
  {
    title: "Crédito y cartera",
    description:
      "Recargá saldo, asigná presupuesto a cuentas ads y seguí cada movimiento con claridad.",
  },
  {
    title: "Operación asistida",
    description:
      "Un puente entre tu equipo y la operación publicitaria: clientes, cuentas y soporte en un flujo.",
  },
  {
    title: "Herramientas de control",
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
  return (
    <section
      id="soluciones"
      className="scroll-mt-20 px-4 py-12 sm:scroll-mt-24 sm:px-6 sm:py-16 lg:px-8 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.45rem]">
            Holistic Core
          </p>
          <h2 className="mt-2 max-w-[22ch] text-[1.65rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.2rem] lg:text-[2.35rem]">
            Soluciones publicitarias pensadas para operar, no para decorar.
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] font-medium leading-7 text-[var(--auth-text-muted)] sm:mt-4 sm:text-[16px]">
            Todo lo que necesitás para crecer con control: pagos, saldos,
            cuentas y seguimiento en un panel formal y claro.
          </p>
        </LandingReveal>

        <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:gap-5">
          {ITEMS.map((item, index) => (
            <LandingReveal key={item.title} delayMs={60 + index * 30}>
              <article className="auth-panel h-full rounded-[1.1rem] p-5 sm:rounded-[1.25rem] sm:p-7">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--auth-accent)]/20 bg-[var(--auth-accent-soft)] sm:h-10 sm:w-10">
                  <span className="h-2 w-2 rounded-full bg-[var(--auth-accent)] sm:h-2.5 sm:w-2.5" />
                </div>
                <h3 className="mt-4 text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)] sm:mt-5 sm:text-[1.15rem]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-6 text-[var(--auth-text-muted)] sm:mt-2 sm:text-[15px] sm:leading-7">
                  {item.description}
                </p>
              </article>
            </LandingReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
