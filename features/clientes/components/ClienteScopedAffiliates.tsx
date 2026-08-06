import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import type { HecomClienteDashboard } from "@/lib/hecom/cliente-dashboard.server";

/**
 * Afiliados — mismo lenguaje visual que Overview / Pagos.
 * Sin link a /clientes (el programa es de la org, no por cliente Hecom).
 */
export function ClienteScopedAffiliates({
  data,
}: {
  data: HecomClienteDashboard;
}) {
  const { cliente } = data;

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
                  Programa de afiliados · {cliente.name}
                </p>
              </div>
            </div>

            <h1 className="font-display mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--auth-text)] sm:text-[2.35rem]">
              Afiliados
            </h1>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[16px] sm:leading-7">
              Si aplica para {cliente.name}. No es el core de ads ni de pagos —
              el programa es de la organización, no por cliente en Hecom.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href={routes.payments}
                className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.3)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
              >
                Ir a pagos
              </Link>
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
                Alcance
              </p>
              <p className="mt-2 font-display text-[1.35rem] font-semibold leading-snug tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.5rem]">
                Org · no por cliente
              </p>
              <p className="mt-3 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                Acá no se mezclan referrals de otros. Seguís en contexto de{" "}
                {cliente.name}.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.07)] bg-[#0f0e0c] text-white shadow-[0_18px_40px_rgb(15_14_12_/_0.18)]">
        <div className="border-b border-white/10 px-5 py-4 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4a]">
            Estado del módulo
          </p>
          <p className="mt-1 text-[14px] font-medium text-white/70">
            Sin afiliados por cliente en Hecom Club
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3">
          {[
            { label: "Referrals Hecom", value: "—", hint: "No por cliente" },
            { label: "Alcance", value: "Org", hint: "Programa agencia" },
            {
              label: "Contexto",
              value: cliente.name.split(" ")[0] ?? cliente.name,
              hint: "Filtro activo",
              accent: true,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="border-t border-white/10 px-5 py-5 sm:border-t-0 sm:border-l sm:border-white/10 sm:px-6 sm:first:border-l-0"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                {item.label}
              </p>
              <p
                className={`mt-2 truncate font-display text-[1.15rem] font-semibold tracking-[-0.03em] sm:text-[1.3rem] ${
                  item.accent ? "text-[#ff9a4a]" : "text-white"
                }`}
              >
                {item.value}
              </p>
              <p className="mt-1 text-[11px] font-medium text-white/40">
                {item.hint}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.08)] bg-white shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
        <div className="border-b border-[rgb(20_18_16_/_0.06)] px-5 py-4 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
            Qué hacer ahora
          </p>
          <h2 className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
            Seguí con ads y creativos
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--auth-text-muted)]">
            El panel de {cliente.name} sigue filtrado. Usá pagos, cuentas o el
            analizador creativo.
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
              className="rounded-[1.1rem] border border-[rgb(20_18_16_/_0.08)] bg-white px-4 py-3.5 transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[rgb(255_120_31_/_0.35)] hover:shadow-[0_10px_24px_rgb(255_120_31_/_0.1)]"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--auth-accent)]">
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
