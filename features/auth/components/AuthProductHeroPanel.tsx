/** Panel derecho auth — dashboard Ads Holistic (mockup). */
export function AuthProductHeroPanel({
  eyebrow = "Ads Holistic",
  title = "TikTok Ads para empresas, con control y resultados claros.",
  subtitle = "Cartera, cuentas y rendimiento en un solo lugar — listo para operar.",
}: {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="relative flex h-full min-h-[520px] flex-col overflow-hidden rounded-[1.25rem] bg-[#12141a] p-7 text-white sm:p-8">
      <div
        className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgb(255_120_31_/_0.45)_0%,transparent_68%)] blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgb(255_120_31_/_0.18)_0%,transparent_70%)] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgb(255 255 255 / 0.07) 0.6px, transparent 0.6px)",
          backgroundSize: "18px 18px",
        }}
        aria-hidden
      />

      <div className="relative z-10">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[var(--auth-accent)]">
          {eyebrow}
        </p>
        <h2 className="mt-3 max-w-[19rem] text-[1.45rem] font-bold leading-[1.2] tracking-[-0.03em] sm:text-[1.65rem]">
          {title}
        </h2>
        <p className="mt-2.5 max-w-[20rem] text-[13px] font-medium leading-5 text-white/65">
          {subtitle}
        </p>
      </div>

      <div className="relative z-10 mt-7 grid grid-cols-3 gap-2">
        {[
          { label: "ROAS", value: "4.8x", delta: "+12%", up: true },
          { label: "Conversiones", value: "12.4K", delta: "+8%", up: true },
          { label: "Inversión activa", value: "S/ 18.5K", delta: "−3%", up: false },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-white/10 bg-white/[0.05] px-2.5 py-3 backdrop-blur-sm"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
              {kpi.label}
            </p>
            <p className="mt-1 text-[15px] font-bold tracking-[-0.02em] sm:text-[16px]">
              {kpi.value}
            </p>
            <p
              className={`mt-0.5 text-[11px] font-semibold ${
                kpi.up ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {kpi.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-3 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3.5">
        <p className="text-[11px] font-semibold text-white/55">
          Crecimiento en conversiones
        </p>
        <svg
          viewBox="0 0 280 96"
          className="mt-2 h-[88px] w-full"
          fill="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="authChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff781f" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff781f" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 72 C 28 68, 42 58, 70 54 C 98 50, 112 62, 140 48 C 168 34, 182 28, 210 22 C 238 16, 252 30, 280 18 L 280 96 L 0 96 Z"
            fill="url(#authChartFill)"
          />
          <path
            d="M0 72 C 28 68, 42 58, 70 54 C 98 50, 112 62, 140 48 C 168 34, 182 28, 210 22 C 238 16, 252 30, 280 18"
            stroke="#ff781f"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="210" cy="22" r="4" fill="#ff781f" />
          <circle cx="210" cy="22" r="7" fill="#ff781f" fillOpacity="0.25" />
        </svg>
      </div>

      <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
        {[
          {
            title: "Estrategia",
            body: "Plan claro por objetivo",
            icon: (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
              />
            ),
          },
          {
            title: "Optimización",
            body: "Ajustes con data real",
            icon: (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z M13.5 10.5V3.75a7.5 7.5 0 016.75 6.75H13.5z"
              />
            ),
          },
          {
            title: "Crecimiento",
            body: "Escala con control",
            icon: (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
              />
            ),
          },
        ].map((item) => (
          <div key={item.title} className="min-w-0">
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-[var(--auth-accent)]/15 text-[var(--auth-accent)]">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.7}
              >
                {item.icon}
              </svg>
            </span>
            <p className="mt-2 text-[12px] font-bold tracking-[-0.01em]">
              {item.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-white/50">
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
