/**
 * Visual stage del flujo real de pagos (mock UI del producto).
 */
export function LandingProductStage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-2 rounded-[1.5rem] bg-[radial-gradient(circle_at_30%_20%,rgb(255_120_31_/_0.18),transparent_55%)] blur-xl sm:-inset-4 sm:rounded-[1.75rem] sm:blur-2xl lg:-inset-6"
      />
      <div className="relative overflow-hidden rounded-[1rem] border border-[rgb(15_23_42_/_0.08)] bg-white shadow-[0_16px_40px_rgb(15_23_42_/_0.1)] sm:rounded-[1.25rem] sm:shadow-[0_20px_50px_rgb(15_23_42_/_0.1)]">
        <div className="flex items-center gap-2 border-b border-[rgb(15_23_42_/_0.06)] bg-[#f8fafc] px-3 py-2 sm:px-4 sm:py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#cbd5e1] sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-[#cbd5e1] sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-[#cbd5e1] sm:h-2.5 sm:w-2.5" />
          <p className="ml-1.5 truncate text-[10px] font-semibold tracking-[0.04em] text-[#64748b] sm:ml-2 sm:text-[11px]">
            holistic · Pagos
          </p>
          <span className="ml-auto rounded-md bg-[#ecfdf5] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#047857] sm:text-[10px]">
            En vivo
          </span>
        </div>

        <div className="space-y-3 p-3 sm:space-y-3.5 sm:p-5">
          <div className="relative overflow-hidden rounded-xl border border-[rgb(15_23_42_/_0.08)] bg-white px-3 py-3 sm:px-4 sm:py-3.5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[var(--auth-accent)]"
            />
            <p className="pl-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)] sm:text-[10px]">
              Cartera Holistic
            </p>
            <div className="mt-2 flex items-end justify-between gap-2 pl-2 sm:gap-3">
              <div>
                <p className="text-[10px] font-medium text-[#64748b] sm:text-[11px]">Disponible</p>
                <p className="mt-0.5 text-[1.35rem] font-bold tracking-[-0.04em] tabular-nums text-[var(--auth-text)] sm:text-[1.65rem]">
                  $2,480.00
                </p>
              </div>
              <span className="mb-0.5 inline-flex h-7 items-center rounded-lg bg-[var(--auth-accent)] px-2.5 text-[11px] font-bold text-white sm:mb-1 sm:h-8 sm:px-3 sm:text-[12px]">
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
                      ? "rounded-md bg-[var(--auth-accent-soft)] px-2 py-1 text-[10px] font-bold text-[var(--auth-accent)]"
                      : "rounded-md bg-[#f1f5f9] px-2 py-1 text-[10px] font-semibold text-[#64748b]"
                  }
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[rgb(15_23_42_/_0.08)] bg-white">
            <div className="flex items-center justify-between border-b border-[rgb(15_23_42_/_0.06)] px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">
                Asignar a cuenta ads
              </p>
              <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[#475569]">
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
                  className="flex items-center justify-between gap-3 border-b border-[rgb(15_23_42_/_0.05)] px-4 py-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold">
                      <span className="text-[#25f4ee]">T</span>
                      <span className="text-[#fe2c55]">T</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                        {row.name}
                      </p>
                      <span
                        className={
                          row.on
                            ? "mt-1 inline-flex rounded bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]"
                            : "mt-1 inline-flex rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748b]"
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                  <p className="shrink-0 text-[13px] font-bold tabular-nums tracking-[-0.02em] text-[var(--auth-text)]">
                    {row.bal}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
