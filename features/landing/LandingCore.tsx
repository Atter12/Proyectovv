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
    <section id="soluciones" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <LandingReveal>
          <p className="text-[1.35rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)] sm:text-[1.5rem]">
            Holistic Core
          </p>
          <h2 className="mt-2 max-w-[22ch] text-[2rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.35rem]">
            Soluciones publicitarias pensadas para operar, no para decorar.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] font-medium leading-7 text-[var(--auth-text-muted)]">
            Todo lo que necesitás para crecer con control: pagos, saldos,
            cuentas y seguimiento en un panel formal y claro.
          </p>
        </LandingReveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:gap-5">
          {ITEMS.map((item, index) => (
            <LandingReveal key={item.title} delayMs={80 + index * 40}>
              <article className="auth-panel h-full rounded-[1.25rem] p-6 sm:p-7">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--auth-accent)]/20 bg-[var(--auth-accent-soft)]">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--auth-accent)]" />
                </div>
                <h3 className="mt-5 text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-[15px] leading-7 text-[var(--auth-text-muted)]">
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
