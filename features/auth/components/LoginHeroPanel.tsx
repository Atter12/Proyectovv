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
      <div className="max-w-[32rem]">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
          Panel para anunciantes
        </p>
        <h1 className="font-display mt-3 text-[1.85rem] font-bold leading-[1.18] tracking-[-0.035em] text-[var(--auth-text)] sm:text-[2.05rem] lg:text-[2.2rem]">
          Opera campañas, pagos y saldos en un solo lugar
        </h1>
        <p className="mt-3.5 max-w-[28rem] text-[15px] font-medium leading-7 text-[var(--auth-text-muted)]">
          Plataforma para agencias y equipos de performance que necesitan
          control real de cartera y cuentas TikTok.
        </p>

        <ul className="mt-8 space-y-5 border-t border-[var(--auth-divider)] pt-8">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex gap-3.5">
              <span
                className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--auth-accent)] shadow-[0_0_0_3px_var(--auth-accent-soft)]"
                aria-hidden
              />
              <div>
                <p className="text-[14px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                  {feature.title}
                </p>
                <p className="mt-0.5 text-[13.5px] leading-6 text-[var(--auth-text-muted)]">
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
