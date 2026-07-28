/**
 * Visual stage of the real payments flow (not a stock dashboard mock).
 * Mirrors Holistic dashboard language: cartera → asignar → historial.
 */
export function LandingProductStage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 rounded-[1.5rem] bg-[linear-gradient(145deg,rgb(255_120_31_/_0.18),transparent_42%,rgb(20_18_16_/_0.04))] blur-2xl sm:-inset-5"
      />
      <div className="relative overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.1)] bg-[#fffcf8] shadow-[0_24px_60px_rgb(20_18_16_/_0.12)]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0d8ce]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0d8ce]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0d8ce]" />
          <p className="ml-2 truncate text-[11px] font-medium tracking-wide text-[#8a8178]">
            Pagos · cliente activo
          </p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {/* Wallet block */}
          <div className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-white px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a5a38]">
              Cartera Holistic
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] text-[#7a736a]">Disponible</p>
                <p className="mt-0.5 text-[1.55rem] font-semibold tracking-[-0.03em] tabular-nums text-[#1a1612]">
                  $2,480.00
                </p>
              </div>
              <span className="mb-1 inline-flex h-8 items-center rounded-md bg-[#e85a1c] px-3 text-[12px] font-semibold text-white">
                Recargar
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              {["1 Recargar", "2 Asignar", "3 Gastar"].map((label, i) => (
                <span
                  key={label}
                  className={`rounded-md px-2 py-1 text-[10px] font-medium ${
                    i === 0
                      ? "bg-[#fff1e8] text-[#c45a18]"
                      : "bg-[#f3eee8] text-[#7a736a]"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Allocate row */}
          <div className="rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-white">
            <div className="border-b border-[rgb(20_18_16_/_0.06)] px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a5a38]">
                Asignar a cuenta ads
              </p>
            </div>
            <ul className="divide-y divide-[rgb(20_18_16_/_0.05)]">
              {[
                { name: "TikTok · BM Principal", bal: "$640.00", on: true },
                { name: "TikTok · Scaling", bal: "$210.00", on: false },
              ].map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold">
                      <span className="text-[#25f4ee]">T</span>
                      <span className="text-[#fe2c55]">T</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-[#1a1612]">
                        {row.name}
                      </p>
                      <p className="text-[10px] text-[#8a8178]">
                        {row.on ? "Activa" : "Pausa"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-[12px] font-semibold tabular-nums text-[#1a1612]">
                    {row.bal}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Hecom historial strip */}
          <div className="rounded-xl border border-dashed border-[rgb(20_18_16_/_0.12)] bg-[#faf7f3] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a8178]">
              Historial Hecom · solo lectura
            </p>
            <div className="mt-2 flex justify-between text-[12px]">
              <span className="text-[#5c564e]">Cobros</span>
              <span className="font-semibold tabular-nums text-[#1f5c40]">
                +$4,200
              </span>
            </div>
            <div className="mt-1 flex justify-between text-[12px]">
              <span className="text-[#5c564e]">Gastos ads</span>
              <span className="font-semibold tabular-nums text-[#1a1612]">
                −$3,180
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
