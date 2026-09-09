/** Panel derecho registro — Ads Holistic + Crédito Holistic (mockup Sebastian). */
export function RegisterHeroPanel() {
  return (
    <div className="relative flex h-full min-h-[520px] flex-col justify-between overflow-hidden rounded-[1.25rem] bg-[linear-gradient(145deg,#ff7a1f_0%,#ff5a2a_42%,#7c3aed_100%)] p-8 text-white">
      <div
        className="pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full bg-white/15 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-[#2e1065]/40 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.18em] text-white/80">
          Bienvenido
        </p>
        <h2 className="mt-3 max-w-[16rem] text-[1.85rem] font-bold leading-[1.15] tracking-[-0.03em]">
          Tu operación de ads, en un solo lugar
        </h2>
        <p className="mt-3 max-w-[18rem] text-[14px] font-medium leading-6 text-white/85">
          Registrate una vez: quedás en Hecom Club y en Ads Holistic con la misma
          ficha.
        </p>
      </div>

      <div className="relative z-10 mt-10 space-y-3">
        <div className="rounded-2xl border border-white/25 bg-white/15 px-4 py-3.5 backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">
            Producto
          </p>
          <p className="mt-1 text-[16px] font-bold tracking-[-0.02em]">
            Ads Holistic
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-white/85">
            Cartera, cuentas TikTok y pagos desde el overview.
          </p>
        </div>
        <div className="rounded-2xl border border-white/25 bg-white/15 px-4 py-3.5 backdrop-blur-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">
            Opcional
          </p>
          <p className="mt-1 text-[16px] font-bold tracking-[-0.02em]">
            Crédito Holistic
          </p>
          <p className="mt-0.5 text-[13px] leading-5 text-white/85">
            Podés solicitarlo después; la aprobación es aparte.
          </p>
        </div>
      </div>
    </div>
  );
}
