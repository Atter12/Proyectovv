const FEATURES = [
  {
    title: "Activa en minutos",
    description: "Organización lista sin fricción de setup.",
  },
  {
    title: "Cartera desde el día uno",
    description: "Cuentas ads y saldos listos para operar.",
  },
  {
    title: "Soporte Latam",
    description: "Atención en español para Perú y la región.",
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Regístrate",
    description: "Completá tus datos de anunciante.",
  },
  {
    step: "02",
    title: "Verifica",
    description: "Confirmá tu correo con un código.",
  },
  {
    step: "03",
    title: "Opera",
    description: "Recargá cartera y asigná a TikTok.",
  },
] as const;

export function RegisterHeroPanel() {
  return (
    <div className="relative z-10 hidden min-h-0 flex-col justify-center py-6 lg:flex lg:py-10">
      <div className="max-w-[36rem]">
        <p className="text-[0.78rem] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
          Registro gratuito
        </p>
        <h1 className="mt-3 text-[2.1rem] font-bold leading-[1.15] tracking-[-0.035em] text-[var(--auth-text)] sm:text-[2.45rem] xl:text-[2.7rem]">
          Crea tu cuenta y opera con control real
        </h1>
        <p className="mt-4 max-w-xl text-[15px] font-medium leading-7 text-[var(--auth-text-muted)] sm:text-[16px]">
          Unite a agencias y equipos que centralizan campañas, pagos y cuentas
          TikTok en un solo panel.
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

      <div className="auth-panel relative z-10 mt-10 max-w-[28rem] rounded-[1.25rem] p-6 sm:p-7">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-text-soft)]">
          Cómo empezar
        </p>
        <ol className="mt-5 space-y-5">
          {STEPS.map((item) => (
            <li key={item.step} className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--auth-accent)] text-[12px] font-bold text-white">
                {item.step}
              </span>
              <div>
                <p className="text-[15px] font-bold tracking-[-0.01em] text-[var(--auth-text)]">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[14px] leading-6 text-[var(--auth-text-muted)]">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
