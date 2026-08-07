/**
 * Visual stage del flujo real de pagos — specimen del producto (Exquisitus plate energy).
 */
export function LandingProductStage() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-3 rounded-[1rem] bg-[radial-gradient(circle_at_30%_20%,rgb(255_120_31_/_0.16),transparent_55%)] blur-xl sm:-inset-5"
      />
      <div
        className="relative overflow-hidden rounded-[0.75rem] border border-[var(--landing-hairline)] bg-white"
        style={{
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.8), inset 0 4px 8px -6px rgb(20 16 8 / 0.12), 0 18px 40px -18px rgb(20 16 8 / 0.28)",
        }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--landing-hairline)] bg-[oklch(0.985_0_0)] px-3 py-2.5 sm:px-4">
          <span className="h-2 w-2 rounded-full bg-[var(--landing-hairline)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--landing-hairline)]" />
          <span className="h-2 w-2 rounded-full bg-[var(--landing-hairline)]" />
          <p className="font-register ml-1.5 truncate text-[0.7rem] font-medium tracking-[0.04em] text-[var(--landing-muted)]">
            holistic · Pagos
          </p>
          <span className="font-register ml-auto rounded-md bg-[rgb(255_120_31_/_0.1)] px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.06em] text-[var(--landing-accent-text)]">
            En vivo
          </span>
        </div>

        <div className="space-y-3 p-3 sm:space-y-3.5 sm:p-5">
          <div className="relative overflow-hidden rounded-[0.5rem] border border-[var(--landing-hairline)] bg-white px-3 py-3 sm:px-4 sm:py-3.5">
            <p className="landing-label pl-0">Cartera Holistic</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-[0.7rem] text-[var(--landing-muted)]">
                  Disponible
                </p>
                <p className="font-register mt-0.5 text-[1.45rem] font-bold tracking-[-0.04em] tabular-nums text-[var(--landing-ink)] sm:text-[1.65rem]">
                  $2,480.00
                </p>
              </div>
              <span className="mb-0.5 inline-flex h-8 items-center rounded-md bg-[var(--landing-cta)] px-3 font-register text-[0.75rem] font-bold text-white">
                Recargar
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                { label: "1 Recargar", on: true },
                { label: "2 Asignar", on: false },
                { label: "3 Gastar", on: false },
              ].map((item) => (
                <span
                  key={item.label}
                  className={
                    item.on
                      ? "rounded-md bg-[rgb(255_120_31_/_0.12)] px-2 py-1 font-register text-[0.65rem] font-bold text-[var(--landing-accent-text)]"
                      : "rounded-md bg-[oklch(0.965_0_0)] px-2 py-1 font-register text-[0.65rem] font-medium text-[var(--landing-muted)]"
                  }
                >
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[0.5rem] border border-[var(--landing-hairline)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--landing-hairline)] px-4 py-2.5">
              <p className="font-register text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--landing-muted)]">
                Asignar a cuenta ads
              </p>
              <span className="rounded bg-[oklch(0.965_0_0)] px-1.5 py-0.5 font-register text-[0.65rem] font-bold tabular-nums text-[var(--landing-body)]">
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
                  className="flex items-center justify-between gap-3 border-b border-[var(--landing-hairline)] px-4 py-3 last:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#16161a] text-[8px] font-bold">
                      <span className="text-[#25f4ee]">T</span>
                      <span className="text-[#fe2c55]">T</span>
                    </span>
                    <div className="min-w-0">
                      <p className="font-register truncate text-[0.8125rem] font-bold tracking-[-0.02em] text-[var(--landing-ink)]">
                        {row.name}
                      </p>
                      <span
                        className={
                          row.on
                            ? "mt-1 inline-flex rounded bg-[#ecf7f0] px-1.5 py-0.5 text-[0.65rem] font-bold text-[#1f5c40]"
                            : "mt-1 inline-flex rounded bg-[oklch(0.965_0_0)] px-1.5 py-0.5 text-[0.65rem] font-medium text-[var(--landing-muted)]"
                        }
                      >
                        {row.status}
                      </span>
                    </div>
                  </div>
                  <p className="font-register shrink-0 text-[0.8125rem] font-bold tabular-nums tracking-[-0.02em] text-[var(--landing-ink)]">
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
