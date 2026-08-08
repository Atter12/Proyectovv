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

/** Hero desktop (columna izquierda). */
export function LoginHeroPanel() {
  return (
    <div className="relative z-10 hidden min-h-0 flex-col justify-center lg:flex">
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

/** Intro compacta solo móvil/tablet — da diseño cuando el hero desktop está oculto. */
export function LoginMobileIntro() {
  return (
    <div className="relative mb-6 lg:hidden">
      <div className="overflow-hidden rounded-[1.25rem] border border-[var(--auth-border)] bg-white/80 p-5 shadow-[0_18px_40px_-28px_rgb(28_25_23_/_0.22)] backdrop-blur-sm">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgb(255_120_31_/_0.22),transparent_68%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 -left-6 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgb(255_176_120_/_0.28),transparent_70%)]"
          aria-hidden
        />

        <p className="relative text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
          Panel para anunciantes
        </p>
        <h1 className="font-display relative mt-2 text-[1.45rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)]">
          Opera campañas, pagos y saldos en un solo lugar
        </h1>
        <p className="relative mt-2 text-[13.5px] font-medium leading-6 text-[var(--auth-text-muted)]">
          Cartera, TikTok Ads y Hecom Club — sin planillas.
        </p>

        <ul className="relative mt-4 grid gap-2">
          {FEATURES.map((feature) => (
            <li
              key={feature.title}
              className="flex items-center gap-2.5 rounded-xl bg-[var(--auth-accent-soft)]/70 px-3 py-2.5"
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--auth-accent)]"
                aria-hidden
              />
              <span className="text-[13px] font-semibold text-[var(--auth-text)]">
                {feature.title}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
