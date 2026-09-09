/** Panel derecho login — copy del mockup Holistic. */
export function LoginHeroPanel() {
  return (
    <div className="relative z-10 flex h-full min-h-[520px] flex-col justify-start px-8 pb-10 pt-10 sm:px-10">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[var(--auth-accent)]">
        Más que marketing
      </p>
      <h2 className="mt-3 max-w-[17rem] text-[1.85rem] font-bold leading-[1.18] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2.05rem]">
        Impulsamos ideas que{" "}
        <span className="text-[var(--auth-accent)]">generan resultados</span>.
      </h2>
      <p className="mt-3.5 max-w-[18rem] text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
        Estrategia, creatividad y tecnología para hacer crecer tu negocio.
      </p>
    </div>
  );
}

/** Intro compacta solo móvil/tablet. */
export function LoginMobileIntro() {
  return (
    <div className="relative mb-5 overflow-hidden rounded-[1.25rem] bg-[linear-gradient(145deg,#fff7f0_0%,#ffe8d6_55%,#ffd4b8_100%)] px-5 py-4 lg:hidden">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
        Más que marketing
      </p>
      <p className="mt-1.5 text-[1.05rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)]">
        Ideas que{" "}
        <span className="text-[var(--auth-accent)]">generan resultados</span>
      </p>
    </div>
  );
}
