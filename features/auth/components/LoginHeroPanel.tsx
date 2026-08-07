import { TechloProductPanel } from "@/features/landing/TechloProductPanel";

const FEATURES = [
  {
    title: "Cartera y saldos",
    description: "Recargá y asigná presupuesto a cuentas ads en un solo flujo.",
  },
  {
    title: "Pagos integrados",
    description: "Stripe, pasarelas locales e historial Hecom sin planillas.",
  },
  {
    title: "Operación Latam",
    description: "Soporte en español para agencias y equipos de performance.",
  },
] as const;

export function LoginHeroPanel({
  alwaysVisible = false,
}: {
  /** Landing: mostrar también en mobile. Login: solo desktop. */
  alwaysVisible?: boolean;
}) {
  return (
    <div
      className={
        alwaysVisible
          ? "relative z-10 flex min-h-0 flex-col justify-center px-4 py-6 sm:px-6 lg:px-0 lg:py-10"
          : "relative z-10 hidden min-h-0 flex-col justify-center px-4 py-6 sm:px-6 lg:flex lg:px-0 lg:py-10"
      }
    >
      <div className="max-w-[36rem]">
        <p className="text-[0.78rem] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
          Panel para anunciantes
        </p>
        <h1 className="mt-3 text-[2.1rem] font-bold leading-[1.15] tracking-[-0.035em] text-[var(--auth-text)] sm:text-[2.45rem] xl:text-[2.7rem]">
          Opera campañas, pagos y saldos en un solo lugar
        </h1>
        <p className="mt-4 max-w-xl text-[15px] font-medium leading-7 text-[var(--auth-text-muted)] sm:text-[16px]">
          Plataforma para agencias y equipos de performance que necesitan
          control real — no otra dashboard genérica.
        </p>

        <ul className="mt-8 space-y-4">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-3.5">
              <span
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)]"
                aria-hidden
              >
                <span className="h-2 w-2 rounded-full bg-[var(--auth-accent)]" />
              </span>
              <div>
                <p className="text-[15px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                  {feature.title}
                </p>
                <p className="mt-0.5 text-[14px] leading-6 text-[var(--auth-text-muted)]">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 max-w-[28rem]">
        <TechloProductPanel />
      </div>
    </div>
  );
}
