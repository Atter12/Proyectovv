export function CreativeAnalyzerCTA() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#e5e7eb] bg-white p-8 sm:p-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#4056ff]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-[#7c3aed]/10 blur-3xl" />

      <div className="relative z-10 text-center">
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {["Puntuación creativa", "Referencias", "Control de políticas"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-[#dbe1ea] bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#64748b] backdrop-blur-sm"
            >
              {chip}
            </span>
          ))}
        </div>

        <h2 className="text-xl font-bold text-[#0f172a] sm:text-2xl">
          ¿Listo para escalar tus anuncios?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[#64748b]">
          Prueba el analizador creativo y descubre qué piezas tienen mayor
          potencial antes de invertir más presupuesto.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#creative-benchmark"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#4056ff] px-6 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#4056ff]/90 hover:shadow-md sm:w-auto"
          >
            Probar gratis
          </a>
          <a
            href="#creative-workflow"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-[#dbe1ea] bg-white px-6 text-sm font-semibold text-[#4056ff] transition-all duration-200 hover:bg-[#4056ff]/5 sm:w-auto"
          >
            Ver ejemplo de análisis
          </a>
        </div>
      </div>
    </section>
  );
}
