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
    <div className="dashboard-surface-card relative min-h-[220px] overflow-hidden rounded-2xl sm:min-h-[250px] lg:min-h-[280px]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--brand-coral),var(--brand-primary),var(--brand-accent))]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--brand-primary)]/[0.08] blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col gap-6 p-5 pl-6 sm:gap-8 sm:p-7 sm:pl-8 lg:flex-row lg:items-center lg:justify-between lg:p-8 lg:pl-9">
        <div className="min-w-0 max-w-xl">
          <p className="text-[13px] font-semibold tracking-[0.04em] text-[var(--brand-primary-deep)]">
            Bienvenido a {siteConfig.name}
          </p>
          <h2 className="font-display mt-2 text-[1.75rem] font-medium leading-[1.12] tracking-[-0.02em] text-[#141210] sm:text-[2rem] lg:text-[2.15rem]">
            Tu operación publicitaria, todo en un solo panel
          </h2>
          <p className="mt-3 max-w-lg text-[15px] leading-7 text-[#6b645c]">
            Gestiona cartera, cuentas publicitarias, pagos y afiliados desde un
            entorno unificado para escalar campañas.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href={routes.clientes}
              className="inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.22)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:bg-[var(--brand-primary-deep)]"
            >
              Ir a Clientes
            </a>
            <Link
              href={routes.adAccounts}
              className="inline-flex h-11 items-center rounded-xl border border-[var(--border-subtle)] bg-white px-5 text-[14px] font-semibold text-[#141210] transition-colors hover:border-[var(--brand-primary)]/30 hover:bg-[var(--surface-soft)]"
            >
              Crear cuenta publicitaria
            </Link>
          </div>
        </div>

        <div className="hidden shrink-0 lg:block">
          <div className="relative h-[200px] w-[260px]">
            {miniMetrics.map((metric, i) => (
              <div
                key={metric.label}
                className="absolute rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 shadow-sm"
                style={{
                  top: `${i * 48}px`,
                  right: `${i * 10}px`,
                  width: i === 2 ? "150px" : "132px",
                }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9a9187]">
                  {metric.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-[#141210]">
                  {metric.value}
                </p>
              </div>
            ))}
            <div className="absolute bottom-0 right-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2">
              <p className="text-[12px] font-semibold text-emerald-800">
                Listo para publicar
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden">
          {miniMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-2"
            >
              <span className="text-[11px] text-[#6b645c]">{metric.label}</span>
              <span className="ml-2 text-sm font-semibold text-[#141210]">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
