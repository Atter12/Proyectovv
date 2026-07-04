const BENEFITS = [
  "Activa tu organización en menos de 5 minutos",
  "Cartera y cuentas publicitarias desde el primer día",
  "Soporte en español para equipos en Perú y Latam",
  "Sin permanencia — crece a tu propio ritmo",
] as const;

const STEPS = [
  { step: 1, title: "Regístrate", description: "Completa tus datos de anunciante" },
  { step: 2, title: "Verifica", description: "Confirma tu correo con un código" },
  { step: 3, title: "Publica", description: "Configura tu primera campaña" },
] as const;

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-emerald-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function RegisterHeroPanel() {
  return (
    <div className="relative hidden flex-col justify-center px-10 py-12 lg:flex xl:px-16">
      <div className="pointer-events-none absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-[#4056ff]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-1/4 right-0 h-48 w-48 rounded-full bg-[#7c3aed]/10 blur-3xl" />

      <div className="relative z-10 max-w-xl">
        <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90 backdrop-blur-sm">
          Registro gratuito
        </span>

        <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          Crea tu cuenta y publica con confianza
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
          Únete a anunciantes y agencias que centralizan campañas, pagos y
          creatividades en un solo panel.
        </p>

        <ul className="mt-8 space-y-4">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckIcon />
              </span>
              <span className="text-sm leading-relaxed text-slate-300">{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Cómo empezar
          </p>
          <ol className="mt-4 space-y-4">
            {STEPS.map((item) => (
              <li key={item.step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-xs font-bold text-white">
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
