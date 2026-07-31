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
    <div className="dashboard-surface-card relative min-h-[220px] overflow-hidden rounded-[1.25rem] sm:min-h-[250px] lg:min-h-[280px]">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#ff781f,#ffa12c)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--auth-accent)]/[0.08] blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col gap-6 p-5 pl-6 sm:gap-8 sm:p-7 sm:pl-8 lg:flex-row lg:items-center lg:justify-between lg:p-8 lg:pl-9">
        <div className="min-w-0 max-w-xl">
          <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
            Bienvenido a {siteConfig.name}
          </p>
          <h2 className="mt-2 text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[2rem] lg:text-[2.15rem]">
            Tu operación publicitaria, todo en un solo panel
          </h2>
          <p className="mt-3 max-w-lg text-[15px] font-medium leading-7 text-[var(--auth-text-muted)]">
            Gestiona cartera, cuentas publicitarias, pagos y afiliados desde un
            entorno unificado para escalar campañas.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a
              href={routes.clientes}
              className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_8px_20px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
            >
              Ir a Clientes
            </a>
            <Link
              href={routes.adAccounts}
              className="inline-flex h-11 items-center rounded-xl border border-[var(--auth-control-border)] bg-white px-5 text-[14px] font-semibold text-[var(--auth-text)] transition-colors hover:bg-[var(--auth-control-hover)]"
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
                className="absolute rounded-xl border border-[var(--auth-divider)] bg-[var(--auth-bg)] px-4 py-3 shadow-sm"
                style={{
                  top: `${i * 48}px`,
                  right: `${i * 10}px`,
                  width: i === 2 ? "150px" : "132px",
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--auth-text-soft)]">
                  {metric.label}
                </p>
                <p className="mt-0.5 text-lg font-bold tracking-[-0.03em] text-[var(--auth-text)]">
                  {metric.value}
                </p>
              </div>
            ))}
            <div className="absolute bottom-0 right-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2">
              <p className="text-[12px] font-bold text-emerald-800">
                Listo para publicar
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden">
          {miniMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-xl border border-[var(--auth-divider)] bg-[var(--auth-bg)] px-3 py-2"
            >
              <span className="text-[11px] text-[var(--auth-text-muted)]">
                {metric.label}
              </span>
              <span className="ml-2 text-sm font-bold text-[var(--auth-text)]">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
