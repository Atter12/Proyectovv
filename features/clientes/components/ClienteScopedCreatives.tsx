import Link from "next/link";
import { routes } from "@/config/routes";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { CopyTextButton } from "@/features/creative-analyzer/components/CopyTextButton.client";
import { CreativeUploadPanel } from "@/features/creative-analyzer/components/CreativeUploadPanel.client";
import type {
  HecomClienteDashboard,
  HecomCreativoCliente,
  HecomCreativoProyecto,
} from "@/lib/hecom/cliente-dashboard.server";

function platformLabel(platform: string | null) {
  if (!platform) return null;
  const p = platform.toLowerCase();
  if (p.includes("tiktok")) return "TikTok";
  if (p.includes("meta") || p.includes("facebook") || p.includes("ig"))
    return "Meta";
  if (p.includes("google") || p.includes("youtube")) return "Google";
  return platform;
}

/**
 * Analizador creativo — layout claro alineado a Overview / Pagos.
 */
export function ClienteScopedCreatives({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, creativosClientes, creativosProyectos, summary } = data;
  const published = creativosProyectos.filter((p) => p.published === true)
    .length;

  const kpis = [
    {
      label: "Fichas",
      value: String(summary.creativeCount),
      accent: true as const,
    },
    {
      label: "Proyectos",
      value: String(summary.projectCount),
    },
    {
      label: "Publicados",
      value: String(published),
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
                  Creativos
                </p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-muted)]">
                  {cliente.name}
                </p>
              </div>
            </div>

            <h1 className="mt-3 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
              Analizador creativo
            </h1>
            <p className="mt-2 max-w-xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
              Fichas y proyectos Hecom. Subí piezas para encolar análisis en
              Holistic.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="#creative-upload"
                className="inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
              >
                Subir creativo
              </a>
              <Link
                href={routes.adAccounts}
                className="inline-flex h-10 items-center rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-accent)] hover:text-[var(--auth-accent)]"
              >
                Ver cuentas
              </Link>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[1rem] border border-[var(--auth-border)] bg-[var(--auth-bg)] p-4 lg:min-w-[220px]">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
              Producción
            </p>
            <p className="mt-2 text-[1.25rem] font-bold tracking-[-0.03em] text-[var(--auth-text)]">
              {summary.projectCount > 0
                ? `${summary.projectCount} proyecto${summary.projectCount === 1 ? "" : "s"}`
                : "Listo para subir"}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--auth-text-muted)]">
              {published > 0
                ? `${published} publicados · subí piezas nuevas abajo.`
                : "Coordiná con la ficha o encolá un análisis."}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Resumen creativos"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="dashboard-kpi rounded-[1rem] px-4 py-3.5"
          >
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
              {kpi.label}
            </p>
            <p
              className={`mt-1.5 text-[1.2rem] font-bold tabular-nums tracking-[-0.03em] ${
                kpi.accent
                  ? "text-[var(--auth-accent)]"
                  : "text-[var(--auth-text)]"
              }`}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </section>

      <CreativeUploadPanel clienteName={cliente.name} />

      <div className="grid gap-5 xl:grid-cols-2">
        <FichasPanel rows={creativosClientes} />
        <ProyectosPanel rows={creativosProyectos} />
      </div>
    </div>
  );
}

function FichasPanel({ rows }: { rows: HecomCreativoCliente[] }) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-border)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Ficha creativa
            </h2>
            <span className="rounded-md bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--auth-accent)]">
              {rows.length}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium text-[var(--auth-text-muted)]">
            Contactos Hecom para coordinar piezas
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 sm:px-6">
          <p className="text-[14px] font-semibold text-[var(--auth-text)]">
            Sin ficha en Hecom
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Cuando exista el contacto creativo, aparece acá con email y empresa.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {rows.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[var(--auth-bg)] sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-[var(--auth-text)]">
                  {item.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.company ? (
                    <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                      {item.company}
                    </span>
                  ) : null}
                  {item.email ? (
                    <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                      {item.email}
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--auth-text-soft)]">
                      Sin detalle de contacto
                    </span>
                  )}
                </div>
                {item.email ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-3">
                    <a
                      href={`mailto:${item.email}?subject=${encodeURIComponent(
                        `Creativos · ${item.name}`,
                      )}`}
                      className="text-[12px] font-bold text-[var(--auth-accent)] underline-offset-2 hover:underline"
                    >
                      Escribir email
                    </a>
                    <CopyTextButton value={item.email} label="Copiar email" />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProyectosPanel({ rows }: { rows: HecomCreativoProyecto[] }) {
  return (
    <section className="dashboard-surface-card flex h-full flex-col overflow-hidden rounded-[1rem]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--auth-border)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Proyectos
            </h2>
            <span className="rounded-md bg-[var(--auth-accent-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--auth-accent)]">
              {rows.length}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium text-[var(--auth-text-muted)]">
            Producción creativa sincronizada
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 sm:px-6">
          <p className="text-[14px] font-semibold text-[var(--auth-text)]">
            Sin proyectos asociados
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Mientras, podés subir una pieza arriba para encolar análisis.
          </p>
          <a
            href="#creative-upload"
            className="mt-3 inline-flex text-[12px] font-bold text-[var(--auth-accent)] underline-offset-2 hover:underline"
          >
            Ir a subir creativo
          </a>
        </div>
      ) : (
        <ul className="max-h-[22rem] flex-1 overflow-y-auto">
          {rows.map((row) => {
            const platform = platformLabel(row.platform);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[var(--auth-bg)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[var(--auth-text)]">
                    {row.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {row.type ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        {row.type}
                      </span>
                    ) : null}
                    {platform ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        {platform}
                      </span>
                    ) : null}
                    {row.format ? (
                      <span className="rounded bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        {row.format}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={
                    row.published
                      ? "shrink-0 rounded-md bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-bold text-[#1f5c40] ring-1 ring-emerald-200/80"
                      : "shrink-0 rounded-md bg-[var(--auth-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--auth-text-muted)] ring-1 ring-[var(--auth-border)]"
                  }
                >
                  {row.published ? "Publicado" : "Borrador"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
