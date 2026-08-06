import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
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
 * Analizador creativo — Rockads + naranja Holistic.
 * Sin link a /clientes.
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
      label: "Fichas creativas",
      value: String(summary.creativeCount),
      hint: "Contactos Hecom",
      accent: true,
    },
    {
      label: "Proyectos",
      value: String(summary.projectCount),
      hint: summary.projectCount > 0 ? "En producción" : "Sin asociar aún",
    },
    {
      label: "Publicados",
      value: String(published),
      hint: "Marcados en Hecom",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="overview-hero relative overflow-hidden rounded-[1.5rem] border border-[rgb(20_18_16_/_0.06)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgb(255_120_31_/_0.18),transparent_55%),radial-gradient(90%_70%_at_100%_10%,rgb(255_161_44_/_0.12),transparent_50%),linear-gradient(165deg,#fff8f3_0%,#ffffff_42%,#fff4ec_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-[-20%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgb(255_120_31_/_0.22),transparent_68%)] blur-2xl"
        />
        <div
          aria-hidden
          className="overview-hero-grid pointer-events-none absolute inset-0 opacity-[0.35]"
        />

        <div className="relative grid gap-8 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)] lg:items-center lg:gap-10 lg:px-10 lg:py-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="lg"
                className="ring-2 ring-white/90 shadow-[0_14px_36px_rgb(255_120_31_/_0.22)]"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
                  {siteConfig.name}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-[var(--auth-text-muted)]">
                  Analizador creativo · {cliente.name}
                </p>
              </div>
            </div>

            <h1 className="font-display mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--auth-text)] sm:text-[2.35rem]">
              Creativos de {cliente.name}
            </h1>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[16px] sm:leading-7">
              Fichas y proyectos Hecom. Abajo podés subir piezas para encolar
              análisis en Holistic.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <a
                href="#creative-upload"
                className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.3)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
              >
                Subir creativo
              </a>
              <Link
                href={routes.adAccounts}
                className="inline-flex h-11 items-center rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white/80 px-5 text-[14px] font-semibold text-[var(--auth-text)] backdrop-blur-sm transition-colors hover:bg-white"
              >
                Ver cuentas
              </Link>
            </div>
          </div>

          <div className="overview-hero-balance relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/75 p-5 shadow-[0_20px_50px_rgb(255_120_31_/_0.12)] backdrop-blur-md sm:p-6">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-text-soft)]">
                Producción
              </p>
              <p className="mt-2 font-display text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.5rem]">
                {summary.projectCount > 0
                  ? `${summary.projectCount} proyecto${summary.projectCount === 1 ? "" : "s"}`
                  : "Listo para subir"}
              </p>
              <p className="mt-3 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                {published > 0
                  ? `${published} publicados en Hecom · subí piezas nuevas abajo.`
                  : "Coordiná con la ficha creativa o encolá un análisis."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Resumen creativos"
        className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.07)] bg-[#0f0e0c] text-white shadow-[0_18px_40px_rgb(15_14_12_/_0.18)]"
      >
        <div className="border-b border-white/10 px-5 py-4 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4a]">
            Holistic en números
          </p>
          <p className="mt-1 text-[14px] font-medium text-white/70">
            Pulso creativo de {cliente.name}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="border-t border-white/10 px-5 py-5 sm:border-t-0 sm:border-l sm:border-white/10 sm:px-6 sm:first:border-l-0"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                {kpi.label}
              </p>
              <p
                className={`mt-2 truncate font-display text-[1.15rem] font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.3rem] ${
                  kpi.accent ? "text-[#ff9a4a]" : "text-white"
                }`}
              >
                {kpi.value}
              </p>
              <p className="mt-1 text-[11px] font-medium text-white/40">
                {kpi.hint}
              </p>
            </div>
          ))}
        </div>
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
    <section className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
              Ficha creativa
            </h2>
            <span className="rounded-md bg-[rgb(255_120_31_/_0.1)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--auth-accent)]">
              {rows.length}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Contactos Hecom para coordinar piezas
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 sm:px-6">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
            Sin ficha en Creativos Hecom
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Cuando exista el contacto creativo en Hecom, aparece acá con email y
            empresa para coordinar piezas.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {rows.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[rgb(255_248_243_/_0.7)] sm:px-6"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                  {item.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.company ? (
                    <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                      {item.company}
                    </span>
                  ) : null}
                  {item.email ? (
                    <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
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
    <section className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
      <div className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-[1.05rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
              Proyectos
            </h2>
            <span className="rounded-md bg-[rgb(255_120_31_/_0.1)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--auth-accent)]">
              {rows.length}
            </span>
          </div>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Producción creativa sincronizada
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-10 sm:px-6">
          <p className="text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
            Sin proyectos asociados
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-5 text-[var(--auth-text-muted)]">
            Los proyectos se sincronizan desde Hecom. Mientras, podés subir una
            pieza arriba para encolar análisis en Holistic.
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
                className="flex items-start justify-between gap-3 border-b border-[rgb(20_18_16_/_0.05)] px-5 py-3.5 transition-colors last:border-0 hover:bg-[rgb(255_248_243_/_0.7)] sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                    {row.name}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {row.type ? (
                      <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        {row.type}
                      </span>
                    ) : null}
                    {platform ? (
                      <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        {platform}
                      </span>
                    ) : null}
                    {row.format ? (
                      <span className="rounded bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--auth-text-muted)]">
                        {row.format}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={
                    row.published
                      ? "shrink-0 rounded-md bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-bold text-[#1f5c40] ring-1 ring-emerald-200/80"
                      : "shrink-0 rounded-md bg-[rgb(20_18_16_/_0.05)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--auth-text-muted)] ring-1 ring-[rgb(20_18_16_/_0.08)]"
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
