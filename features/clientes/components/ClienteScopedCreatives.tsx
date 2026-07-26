import Link from "next/link";
import { Card } from "@/components/ui/Card";
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

export function ClienteScopedCreatives({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente, creativosClientes, creativosProyectos, summary } = data;

  const kpis = [
    {
      label: "Fichas creativas",
      value: String(summary.creativeCount),
      accent: "bg-[#8a8178]",
      hint: "Contactos Hecom",
    },
    {
      label: "Proyectos",
      value: String(summary.projectCount),
      accent: "bg-[#c45a18]",
      hint: summary.projectCount > 0 ? "En producción" : "Sin asociar aún",
    },
    {
      label: "Publicados",
      value: String(
        creativosProyectos.filter((p) => p.published === true).length,
      ),
      accent: "bg-[#2f7a57]",
      hint: "Marcados en Hecom",
    },
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
        <div className="relative px-5 py-5 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.05),transparent)]"
          />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="md"
                className="ring-1 ring-white shadow-sm"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a5a38]">
                  Creativos · Hecom
                </p>
                <h1 className="mt-1 text-[1.25rem] font-medium tracking-[-0.015em] text-[#1a1612] sm:text-[1.35rem]">
                  Creativos de {cliente.name}
                </h1>
                <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-[#6b645c]">
                  Ficha y proyectos en Hecom Club. Abajo podés subir piezas para
                  encolar análisis en Holistic.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={routes.adAccounts}
                className="inline-flex h-9 items-center rounded-lg bg-[#e85a1c] px-3.5 text-[13px] font-medium text-white hover:bg-[#d14e16]"
              >
                Ver cuentas ads
              </Link>
              <Link
                href={`/clientes/${cliente.id}`}
                className="inline-flex h-9 items-center rounded-lg border border-[rgb(20_18_16_/_0.1)] bg-white px-3.5 text-[13px] font-medium text-[#2a241f] hover:bg-[#f6f0e8]"
              >
                Ver ficha
              </Link>
            </div>
          </div>
        </div>

        <div
          aria-label="Resumen creativos"
          className="border-t border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3]"
        >
          <div className="grid sm:grid-cols-3">
            {kpis.map((kpi, index) => (
              <div
                key={kpi.label}
                className={`relative px-4 py-3.5 sm:px-5 ${
                  index < kpis.length - 1
                    ? "border-b border-[rgb(20_18_16_/_0.06)] sm:border-b-0 sm:border-r"
                    : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${kpi.accent}`}
                />
                <p className="pl-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
                  {kpi.label}
                </p>
                <p className="mt-1 pl-2 text-[1.2rem] font-medium tracking-[-0.015em] tabular-nums text-[#1a1612]">
                  {kpi.value}
                </p>
                <p className="mt-0.5 pl-2 text-[11px] text-[#8a8178]">
                  {kpi.hint}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CreativeUploadPanel clienteName={cliente.name} />

      <div className="grid gap-4 xl:grid-cols-2">
        <FichasPanel rows={creativosClientes} />
        <ProyectosPanel rows={creativosProyectos} />
      </div>
    </div>
  );
}

function FichasPanel({ rows }: { rows: HecomCreativoCliente[] }) {
  return (
    <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-0 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-3.5">
        <h2 className="text-[13px] font-medium text-[#1a1612]">
          Ficha creativa
        </h2>
        <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] tabular-nums text-[#6b645c]">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8">
          <p className="text-[13px] font-medium text-[#1a1612]">
            Sin ficha en Creativos Hecom
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#7a736a]">
            Cuando exista el contacto creativo en Hecom, aparece acá con email y
            empresa para coordinar piezas.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[rgb(20_18_16_/_0.05)]">
          {rows.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-[#faf7f3]"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-normal text-[#1a1612]">
                  {item.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[#9a9187]">
                  {[item.company, item.email].filter(Boolean).join(" · ") ||
                    "Sin detalle de contacto"}
                </p>
                {item.email ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <a
                      href={`mailto:${item.email}?subject=${encodeURIComponent(
                        `Creativos · ${item.name}`,
                      )}`}
                      className="text-[11px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
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
    </Card>
  );
}

function ProyectosPanel({ rows }: { rows: HecomCreativoProyecto[] }) {
  return (
    <Card className="rounded-[1.15rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] p-0 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)]">
      <div className="flex items-center justify-between gap-2 border-b border-[rgb(20_18_16_/_0.06)] px-5 py-3.5">
        <h2 className="text-[13px] font-medium text-[#1a1612]">Proyectos</h2>
        <span className="rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[11px] tabular-nums text-[#6b645c]">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-8">
          <p className="text-[13px] font-medium text-[#1a1612]">
            Sin proyectos asociados
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#7a736a]">
            Los proyectos se sincronizan desde Hecom. Mientras, podés subir una
            pieza arriba para encolar análisis en Holistic.
          </p>
          <a
            href="#creative-upload"
            className="mt-3 inline-flex text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
          >
            Ir a subir creativo
          </a>
        </div>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-[rgb(20_18_16_/_0.05)] overflow-y-auto">
          {rows.map((row) => {
            const platform = platformLabel(row.platform);
            return (
              <li
                key={row.id}
                className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-[#faf7f3]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-normal text-[#1a1612]">
                    {row.name}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[#9a9187]">
                    {[row.type, platform, row.format]
                      .filter(Boolean)
                      .join(" · ") || "Sin metadatos"}
                  </p>
                </div>
                <span
                  className={
                    row.published
                      ? "shrink-0 rounded-md bg-[#ecf7f0] px-1.5 py-0.5 text-[10px] font-medium text-[#1f5c40]"
                      : "shrink-0 rounded-md bg-[#f0e9e0] px-1.5 py-0.5 text-[10px] font-medium text-[#7a736a]"
                  }
                >
                  {row.published ? "Publicado" : "Borrador"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
