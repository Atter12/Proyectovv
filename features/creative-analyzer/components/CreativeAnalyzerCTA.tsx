export function CreativeAnalyzerCTA() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white p-8 shadow-[var(--shadow-card)] sm:p-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(23 139 255 / 0.12) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at center, black, transparent 75%)",
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--brand-primary)]/10 blur-3xl" />

      <div className="relative z-10 text-center">
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {["Puntuación creativa", "Referencias", "Control de políticas"].map(
            (chip) => (
              <span
                key={chip}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--admin-text-muted,#64748b)]"
              >
                {chip}
              </span>
            ),
          )}
        </div>

        <h2 className="font-display text-[1.35rem] font-medium text-[var(--foreground)] sm:text-[1.6rem]">
          ¿Listo para escalar tus anuncios?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[14px] leading-6 text-[var(--admin-text-muted,#64748b)]">
          Prueba el analizador creativo y descubre qué piezas tienen mayor
          potencial antes de invertir más presupuesto.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#creative-benchmark"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-6 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)] sm:w-auto"
          >
            Probar gratis
          </a>
          <a
            href="#creative-workflow"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-white px-6 text-[13px] font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)]/5 sm:w-auto"
          >
            Ver ejemplo de análisis
          </a>
        </div>
      </div>
    </section>
  );
}
