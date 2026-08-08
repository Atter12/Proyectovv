import Link from "next/link";
import { routes } from "@/config/routes";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

/**
 * Afiliados — layout claro alineado a Overview / Pagos.
 */
export function ClienteScopedAffiliates({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente } = data;

  const kpis = [
    { label: "Referrals Hecom", value: "—", hint: "No por cliente" },
    { label: "Alcance", value: "Org", hint: "Programa agencia" },
    {
      label: "Contexto",
      value: cliente.name.split(" ")[0] ?? cliente.name,
      hint: "Filtro activo",
      accent: true as const,
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
                  Afiliados
                </p>
                <p className="mt-0.5 truncate text-[12px] font-medium text-[var(--auth-text-muted)]">
                  {cliente.name}
                </p>
              </div>
            </div>

            <h1 className="mt-3 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
              Programa de afiliados
            </h1>
            <p className="mt-2 max-w-xl text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
              Si aplica para {cliente.name}. El programa es de la organización,
              no por cliente en Hecom.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={routes.payments}
                className="inline-flex h-10 items-center rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.05]"
              >
                Ir a pagos
              </Link>
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
              Alcance
            </p>
            <p className="mt-2 text-[1.15rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
              Org · no por cliente
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--auth-text-muted)]">
              Seguís en contexto de {cliente.name}.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Estado del módulo"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {kpis.map((item) => (
          <div
            key={item.label}
            className="dashboard-kpi rounded-[1rem] px-4 py-3.5"
          >
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
              {item.label}
            </p>
            <p
              className={`mt-1.5 truncate text-[1.15rem] font-bold tracking-[-0.03em] ${
                item.accent
                  ? "text-[var(--auth-accent)]"
                  : "text-[var(--auth-text)]"
              }`}
            >
              {item.value}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[var(--auth-text-muted)]">
              {item.hint}
            </p>
          </div>
        ))}
      </section>

      <section className="dashboard-surface-card overflow-hidden rounded-[1rem]">
        <div className="border-b border-[var(--auth-border)] px-5 py-4 sm:px-6">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--auth-accent)]">
            Qué hacer ahora
          </p>
          <h2 className="mt-1.5 text-[1.1rem] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
            Seguí con ads y creativos
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
            El panel de {cliente.name} sigue filtrado. Usá pagos, cuentas o el
            analizador.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          {[
            {
              href: routes.payments,
              eyebrow: "Cartera",
              title: "Pagos",
              hint: "Recargar o fondear BM",
            },
            {
              href: routes.adAccounts,
              eyebrow: "TikTok",
              title: "Cuentas ads",
              hint: "Advertisers aprobados",
            },
            {
              href: routes.creativeAnalyzer,
              eyebrow: "Piezas",
              title: "Creativos",
              hint: "Subir y analizar",
            },
          ].map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className="rounded-[0.85rem] border border-[var(--auth-border)] bg-white px-4 py-3.5 transition-colors hover:border-[var(--auth-accent)]"
            >
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
                {tile.eyebrow}
              </p>
              <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
                {tile.title}
              </p>
              <p className="mt-1 text-[12px] leading-4 text-[var(--auth-text-muted)]">
                {tile.hint}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
