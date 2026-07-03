import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

const miniMetrics = [
  { label: "ROAS", value: "3.8x" },
  { label: "CTR", value: "2.4%" },
  { label: "CPM", value: "$4.20" },
];

export function OverviewHero() {
  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#4056ff] via-[#7c3aed] to-[#581c87] shadow-lg shadow-indigo-500/15 sm:min-h-[260px] sm:rounded-3xl lg:min-h-[300px]">
      {/* Abstract background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, white 1px, transparent 1px), linear-gradient(45deg, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute right-1/3 top-8 h-px w-40 rotate-45 bg-white/20" />
        <div className="absolute bottom-16 left-12 h-px w-24 rotate-12 bg-white/15" />
      </div>

      <div className="relative z-10 flex h-full flex-col gap-6 p-5 sm:gap-8 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-xl">
          <p className="text-sm font-medium text-white/80">
            Bienvenido a {siteConfig.name}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2rem] lg:leading-tight">
            Tu programa publicitario, todo en un solo panel
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/85 sm:text-base">
            Gestiona cartera, cuentas publicitarias, pagos y afiliados desde un
            entorno unificado diseñado para escalar campañas.
          </p>
          <Link
            href={routes.adAccounts}
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-white px-6 text-sm font-semibold text-[#4056ff] shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-lg"
          >
            Crear cuenta publicitaria
          </Link>
        </div>

        {/* Decorative mini dashboard */}
        <div className="hidden shrink-0 lg:block">
          <div className="relative h-[220px] w-[280px]">
            {miniMetrics.map((metric, i) => (
              <div
                key={metric.label}
                className="absolute rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md transition-all duration-200"
                style={{
                  top: `${i * 52}px`,
                  right: `${i * 12}px`,
                  width: i === 2 ? "160px" : "140px",
                }}
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/60">
                  {metric.label}
                </p>
                <p className="mt-0.5 text-lg font-bold text-white">{metric.value}</p>
              </div>
            ))}
            <div className="absolute bottom-0 right-0 rounded-2xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2.5 backdrop-blur-md">
              <p className="text-xs font-semibold text-emerald-100">
                Listo para publicar
              </p>
            </div>
          </div>
        </div>

        {/* Simplified mobile metrics */}
        <div className="flex flex-wrap gap-2 lg:hidden">
          {miniMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm"
            >
              <span className="text-[10px] text-white/60">{metric.label}</span>
              <span className="ml-2 text-sm font-bold text-white">{metric.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
