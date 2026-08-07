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
          ? "relative z-10 flex min-h-0 flex-col justify-center"
          : "relative z-10 hidden min-h-0 flex-col justify-center lg:flex"
      }
    >
      <div className="max-w-[30rem]">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
          Panel para anunciantes
        </p>
        <h1 className="mt-2.5 text-[1.55rem] font-bold leading-[1.25] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.75rem]">
          Opera campañas, pagos y saldos en un solo lugar
        </h1>
        <p className="mt-3 max-w-md text-[14px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[15px] sm:leading-7">
          Plataforma para agencias y equipos de performance que necesitan
          control real de cartera y cuentas TikTok.
        </p>

        <ul className="mt-7 space-y-4 border-t border-[var(--auth-divider)] pt-7">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-3">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--auth-accent)]"
                aria-hidden
              />
              <div>
                <p className="text-[14px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                  {feature.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-6 text-[var(--auth-text-muted)]">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
