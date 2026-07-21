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
    <div className="relative min-h-[220px] overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#0b4f9c_0%,#178bff_52%,#0f7ae5_100%)] shadow-[0_18px_40px_rgb(23_139_255_/_0.22)] sm:min-h-[250px] lg:min-h-[280px]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-[#9af7c9]/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.55) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(ellipse 70% 80% at 70% 40%, black, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 flex h-full flex-col gap-6 p-5 sm:gap-8 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
        <div className="min-w-0 max-w-xl">
          <p className="text-[13px] font-semibold tracking-[0.04em] text-white/80">
            Bienvenido a {siteConfig.name}
          </p>
          <h2 className="font-display mt-2 text-[1.75rem] font-medium leading-[1.12] tracking-[-0.02em] text-white sm:text-[2rem] lg:text-[2.15rem]">
            Tu operación publicitaria, todo en un solo panel
          </h2>
          <p className="mt-3 max-w-lg text-[15px] leading-7 text-white/85">
            Gestiona cartera, cuentas publicitarias, pagos y afiliados desde un
            entorno unificado para escalar campañas.
          </p>
          <Link
            href={routes.adAccounts}
            className="mt-6 inline-flex h-11 items-center rounded-xl bg-white px-5 text-[14px] font-semibold text-[var(--brand-primary)] shadow-md transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg"
          >
            Crear cuenta publicitaria
          </Link>
        </div>

        <div className="hidden shrink-0 lg:block">
          <div className="relative h-[200px] w-[260px]">
            {miniMetrics.map((metric, i) => (
              <div
                key={metric.label}
                className="absolute rounded-xl border border-white/20 bg-white/12 px-4 py-3 backdrop-blur-md"
                style={{
                  top: `${i * 48}px`,
                  right: `${i * 10}px`,
                  width: i === 2 ? "150px" : "132px",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/65">
                  {metric.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-white">
                  {metric.value}
                </p>
              </div>
            ))}
            <div className="absolute bottom-0 right-0 rounded-xl border border-emerald-200/30 bg-emerald-400/20 px-3.5 py-2 backdrop-blur-md">
              <p className="text-[12px] font-semibold text-emerald-50">
                Listo para publicar
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden">
          {miniMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-white/20 bg-white/12 px-3 py-2 backdrop-blur-sm"
            >
              <span className="text-[11px] text-white/70">{metric.label}</span>
              <span className="ml-2 text-sm font-semibold text-white">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
