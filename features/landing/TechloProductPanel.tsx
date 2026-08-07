/**
 * Mock UI del panel real (cartera + asignación) — le da cara de producto
 * al hero. Adaptado de LandingProductStage a la paleta techlo.
 */
export function TechloProductPanel() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 rounded-[1.75rem] bg-[radial-gradient(circle_at_30%_20%,rgb(255_120_31_/_0.14),transparent_60%)] blur-2xl sm:-inset-5"
      />
      <div className="relative overflow-hidden rounded-[1.1rem] border border-[var(--tl-border)] bg-white shadow-[0_24px_60px_-24px_rgb(28_25_23_/_0.25)] sm:rounded-[1.25rem]">
        <div className="flex items-center gap-2 border-b border-[var(--tl-border)] bg-[var(--tl-theme-light)] px-3 py-2 sm:px-4 sm:py-2.5">
          <span className="h-2 w-2 rounded-full bg-[#d6d0c8] sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-[#d6d0c8] sm:h-2.5 sm:w-2.5" />
          <span className="h-2 w-2 rounded-full bg-[#d6d0c8] sm:h-2.5 sm:w-2.5" />
          <p className="ml-1.5 truncate text-[10px] font-semibold tracking-[0.04em] text-[var(--tl-muted)] sm:ml-2 sm:text-[11px]">
            holistic · Pagos
          </p>
          <span className="ml-auto rounded-md bg-[#ecfdf5] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#047857] sm:text-[10px]">
            En vivo
          </span>
        </div>

        <div className="space-y-3 p-3 sm:space-y-3.5 sm:p-5">
          <div className="relative overflow-hidden rounded-xl border border-[var(--tl-border)] bg-white px-3 py-3 sm:px-4 sm:py-3.5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-[3px] bg-[var(--tl-primary)]"
            />
            <p className="pl-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--tl-primary)] sm:text-[10px]">
              Cartera Holistic
            </p>
            <div className="mt-2 flex items-end justify-between gap-2 pl-2 sm:gap-3">
              <div>
                <p className="text-[10px] font-medium text-[var(--tl-muted)] sm:text-[11px]">
                  Disponible
                </p>
                <p className="mt-0.5 text-[1.35rem] font-bold tracking-[-0.04em] tabular-nums text-[var(--tl-dark)] sm:text-[1.65rem]">
                  $2,480.00
                </p>
              </div>
              <span className="mb-0.5 inline-flex h-7 items-center rounded-lg bg-[var(--tl-primary)] px-2.5 text-[11px] font-bold text-white sm:mb-1 sm:h-8 sm:px-3 sm:text-[12px]">
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
                      ? "rounded-md bg-[var(--tl-primary-soft)] px-2 py-1 text-[10px] font-bold text-[var(--tl-primary)]"
                      : "rounded-md bg-[var(--tl-theme-light)] px-2 py-1 text-[10px] font-semibold text-[var(--tl-muted)]"
                  }
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--tl-border)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--tl-border)] px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--tl-muted)]">
                Asignar a cuenta ads
              </p>
              <span className="rounded bg-[var(--tl-theme-light)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--tl-text)]">
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
                  className="flex items-center justify-between gap-3 border-b border-[var(--tl-border)] px-4 py-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold">
                      <span className="text-[#25f4ee]">T</span>
                      <span className="text-[#fe2c55]">T</span>
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-bold tracking-[-0.02em] text-[var(--tl-dark)]">
                        {row.name}
                      </p>
                      <span
                        className={
                          row.on
                            ? "mt-1 inline-flex rounded bg-[#ecfdf5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]"
                            : "mt-1 inline-flex rounded bg-[var(--tl-theme-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--tl-muted)]"
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                  <p className="shrink-0 text-[13px] font-bold tabular-nums tracking-[-0.02em] text-[var(--tl-dark)]">
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
