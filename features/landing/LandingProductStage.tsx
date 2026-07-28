/**
 * Visual stage del flujo real de pagos (no dashboard genérico).
 * Lenguaje desk-brief: cartera → asignar → historial Hecom.
 */
export function LandingProductStage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-4 rounded-[1.75rem] bg-[linear-gradient(145deg,rgb(255_120_31_/_0.2),transparent_45%,rgb(20_18_16_/_0.05))] blur-2xl sm:-inset-6"
      />
      <div className="relative overflow-hidden rounded-2xl border border-[rgb(20_18_16_/_0.1)] bg-[#fffcf8] shadow-[0_28px_70px_rgb(20_18_16_/_0.14)]">
        <div className="flex items-center gap-2 border-b border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0d8ce]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0d8ce]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#e0d8ce]" />
          <p className="ml-2 truncate text-[11px] font-semibold tracking-[0.04em] text-[#8a8178]">
            ads.victorminas28.com · Pagos
          </p>
          <span className="ml-auto rounded bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1f5c40]">
            En vivo
          </span>
        </div>

        <div className="space-y-3.5 p-4 sm:p-5">
          <div className="relative overflow-hidden rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-white px-4 py-3.5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,#e85a1c,#ffa12c)]"
            />
            <p className="pl-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c45a18]">
              Cartera Holistic
            </p>
            <div className="mt-2 flex items-end justify-between gap-3 pl-2">
              <div>
                <p className="text-[11px] text-[#7a736a]">Disponible</p>
                <p className="mt-0.5 text-[1.65rem] font-semibold tracking-[-0.04em] tabular-nums text-[#1a1612]">
                  $2,480.00
                </p>
              </div>
              <span className="mb-1 inline-flex h-8 items-center rounded-lg bg-[#e85a1c] px-3 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgb(232_90_28_/_0.28)]">
                Recargar
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 pl-2">
              {[
                { label: "1 Recargar", on: true },
                { label: "2 Asignar", on: false },
                { label: "3 Gastar", on: false },
              ].map((item) => (
                <span
                  key={item.label}
                  className={
                    item.on
                      ? "rounded-md bg-[#fff1e8] px-2 py-1 text-[10px] font-semibold text-[#c45a18]"
                      : "rounded-md bg-[#f3eee8] px-2 py-1 text-[10px] font-medium text-[#7a736a]"
                  }
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[rgb(20_18_16_/_0.08)] bg-white">
            <div className="flex items-center justify-between border-b border-[rgb(20_18_16_/_0.06)] px-4 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
                Asignar a cuenta ads
              </p>
              <span className="rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#6b645c]">
                2
              </span>
            </div>
            <ul>
              {[
                {
                  name: "TikTok · BM Principal",
                  bal: "$640.00",
                  status: "Activa",
                  on: true,
                },
                {
                  name: "TikTok · Scaling",
                  bal: "$210.00",
                  status: "Pausa",
                  on: false,
                },
              ].map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-4 py-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold">
                      <span className="text-[#25f4ee]">T</span>
                      <span className="text-[#fe2c55]">T</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold tracking-[-0.02em] text-[#1a1612]">
                        {row.name}
                      </p>
                      <span
                        className={
                          row.on
                            ? "mt-1 inline-flex rounded bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-semibold text-[#1f5c40]"
                            : "mt-1 inline-flex rounded bg-[#f3eee8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b645c]"
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                  <p className="shrink-0 text-[13px] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1612]">
                    {row.bal}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-[rgb(20_18_16_/_0.12)] bg-[#faf7f3] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8178]">
              Historial Hecom · solo lectura
            </p>
            <div className="mt-2.5 flex flex-wrap gap-4">
              <div>
                <p className="text-[11px] text-[#7a736a]">Cobros</p>
                <p className="mt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#1f5c40]">
                  +$4,200
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#7a736a]">Gastos ads</p>
                <p className="mt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#1a1612]">
                  −$3,180
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[#7a736a]">Saldo est.</p>
                <p className="mt-0.5 text-[14px] font-semibold tabular-nums tracking-[-0.02em] text-[#c45a18]">
                  $1,020
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
