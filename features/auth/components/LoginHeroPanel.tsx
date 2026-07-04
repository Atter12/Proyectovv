const FEATURES = [
  "Cuentas publicitarias de agencia con límites ampliados",
  "Cartera centralizada y asignación de saldo en un clic",
  "Pasarelas de pago integradas y facturación transparente",
  "Analizador creativo y programa de afiliados incluidos",
] as const;

const TESTIMONIAL = {
  name: "María González",
  location: "México",
  quote:
    "Default Media simplificó por completo la gestión de nuestras campañas. El panel es claro, rápido y el soporte responde al instante.",
  initials: "MG",
} as const;

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

function StarIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export function LoginHeroPanel() {
  return (
    <div className="relative hidden flex-col justify-center px-10 py-12 lg:flex xl:px-16">
      <div className="relative z-10 max-w-xl">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          Impulsa tus ventas con soluciones publicitarias integradas
        </h1>

        <ul className="mt-8 space-y-4">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckIcon />
              </span>
              <span className="text-sm leading-relaxed text-slate-300">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4056ff] to-[#7c3aed] text-sm font-semibold text-white">
                {TESTIMONIAL.initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{TESTIMONIAL.name}</p>
                <p className="text-xs text-slate-400">{TESTIMONIAL.location}</p>
              </div>
            </div>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <StarIcon key={i} />
              ))}
            </div>
          </div>
          <p className="mt-4 text-sm italic leading-relaxed text-slate-300">
            &ldquo;{TESTIMONIAL.quote}&rdquo;
          </p>
          <div className="mt-4 flex justify-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-white" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
