import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format-money";
import { formatNumber } from "@/lib/format-number";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
  hecomScoped?: boolean;
  clienteName?: string;
  clienteId?: string;
  avatarUrl?: string | null;
  hideCreate?: boolean;
}

/**
 * Account Center — mismo lenguaje visual que Overview (Rockads + naranja Holistic).
 * No enlaza a /clientes (gerentes/clientes no usan esa sección).
 */
export function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  avatarUrl,
  hideCreate = false,
}: AdAccountsPageHeaderProps) {
  const description = hecomScoped
    ? `Solo cuentas TikTok Aprobadas de ${clienteName ?? "este cliente"} (estado live del BM). Suspendidas no se listan.`
    : "Seleccioná un cliente en el panel para ver sus cuentas publicitarias.";

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
              {hecomScoped && clienteName ? (
                <HecomClienteAvatar
                  name={clienteName}
                  avatarUrl={avatarUrl}
                  size="lg"
                  className="ring-2 ring-white/90 shadow-[0_14px_36px_rgb(255_120_31_/_0.22)]"
                />
              ) : (
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#16161a] text-[11px] font-bold shadow-[0_14px_36px_rgb(15_14_12_/_0.2)]">
                  <span className="text-[#25f4ee]">T</span>
                  <span className="text-[#fe2c55]">T</span>
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
                  {siteConfig.name}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-[var(--auth-text-muted)]">
                  Account Center
                  {hecomScoped && clienteName ? ` · ${clienteName}` : ""}
                </p>
              </div>
            </div>

            <h1 className="font-display mt-3 text-[2rem] font-semibold leading-[1.1] tracking-[-0.04em] text-[var(--auth-text)] sm:text-[2.35rem]">
              Mis cuentas publicitarias
            </h1>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-6 text-[var(--auth-text-muted)] sm:text-[16px] sm:leading-7">
              {description}
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                href={routes.payments}
                className="inline-flex h-11 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[14px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.3)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
              >
                Ir a fondear
              </Link>
              <Link
                href={routes.overview}
                className="inline-flex h-11 items-center rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white/80 px-5 text-[14px] font-semibold text-[var(--auth-text)] backdrop-blur-sm transition-colors hover:bg-white"
              >
                Descripción general
              </Link>
              {hideCreate ? null : (
                <AdAccountsOpenCreateModalButton className="inline-flex h-11 items-center rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white/80 px-5 text-[14px] font-semibold text-[var(--auth-text)] backdrop-blur-sm transition-colors hover:bg-white">
                  Crear cuenta
                </AdAccountsOpenCreateModalButton>
              )}
            </div>
          </div>

          <div className="overview-hero-balance relative mx-auto w-full max-w-sm lg:mx-0 lg:justify-self-end">
            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/75 p-5 shadow-[0_20px_50px_rgb(255_120_31_/_0.12)] backdrop-blur-md sm:p-6">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ff781f,#ffa12c,#ff781f)]"
              />
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-text-soft)]">
                Saldo asignado
              </p>
              <p className="mt-2 font-display text-[2.15rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--auth-text)] sm:text-[2.4rem]">
                {formatMoney(summary.assignedBalance)}
              </p>
              <p className="mt-3 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                {formatNumber(summary.activeAccounts)} activa
                {summary.activeAccounts === 1 ? "" : "s"} ·{" "}
                {formatNumber(summary.totalAccounts)} total
              </p>
              <p className="mt-2 text-[11px] leading-4 text-[var(--auth-text-soft)]">
                Solo lectura acá. El fondeo se hace en Pagos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Qué podés hacer */}
      <section aria-labelledby="ad-accounts-actions-heading">
        <div className="mb-4 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--auth-accent)]">
            Qué podés hacer
          </p>
          <h2
            id="ad-accounts-actions-heading"
            className="font-display mt-1.5 text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.5rem]"
          >
            Operar cuentas sin fricción
          </h2>
          <p className="mt-1.5 text-[14px] font-medium leading-6 text-[var(--auth-text-muted)]">
            Revisá estado, saldo y pasá a Pagos para fondear al advertiser.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionTile
            href={routes.payments}
            title="Fondear ads"
            body="Stripe o cash BM → asigná a la cuenta lista."
            icon="wallet"
          />
          <ActionTile
            href={`${routes.payments}#asignar-saldo`}
            title="Asignar saldo"
            body="Elegí advertiser aprobado y mové presupuesto."
            icon="boost"
          />
          <ActionTile
            href={routes.overview}
            title="Ver pulso"
            body="Volvé a la descripción general del cliente."
            icon="pulse"
          />
        </div>
      </section>

      {/* Números */}
      <section
        aria-label="Resumen de cuentas"
        className="overflow-hidden rounded-[1.35rem] border border-[rgb(20_18_16_/_0.07)] bg-[#0f0e0c] text-white shadow-[0_18px_40px_rgb(15_14_12_/_0.18)]"
      >
        <div className="border-b border-white/10 px-5 py-4 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#ff9a4a]">
            Holistic en números
          </p>
          <p className="mt-1 text-[14px] font-medium text-white/70">
            Cuentas del cliente seleccionado
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <StatCell
            label="Totales"
            value={formatNumber(summary.totalAccounts)}
            hint="Mapeadas"
          />
          <StatCell
            label="Activas"
            value={formatNumber(summary.activeAccounts)}
            hint="Listas"
            accent
          />
          <StatCell
            label="Saldo"
            value={formatMoney(summary.assignedBalance)}
            hint="Asignado"
          />
          <StatCell
            label="Pendientes"
            value={formatNumber(summary.pendingSetup)}
            hint="Setup"
          />
        </div>
      </section>
    </div>
  );
}

function ActionTile({
  href,
  title,
  body,
  icon,
}: {
  href: string;
  title: string;
  body: string;
  icon: "wallet" | "boost" | "pulse";
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-[1.2rem] border border-[rgb(20_18_16_/_0.08)] bg-white p-5 shadow-[0_10px_28px_rgb(20_18_16_/_0.04)] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-[rgb(255_120_31_/_0.35)] hover:shadow-[0_16px_36px_rgb(255_120_31_/_0.12)]"
    >
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[rgb(255_120_31_/_0.08)] transition-transform group-hover:scale-125"
      />
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]">
        <ActionIcon type={icon} />
      </span>
      <p className="relative mt-3 text-[15px] font-semibold tracking-[-0.02em] text-[var(--auth-text)]">
        {title}
      </p>
      <p className="relative mt-1 text-[13px] leading-5 text-[var(--auth-text-muted)]">
        {body}
      </p>
      <span className="relative mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--auth-accent)]">
        Abrir
        <svg
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
          />
        </svg>
      </span>
    </Link>
  );
}

function ActionIcon({ type }: { type: "wallet" | "boost" | "pulse" }) {
  if (type === "wallet") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
      </svg>
    );
  }
  if (type === "boost") {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function StatCell({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="border-t border-white/10 px-5 py-5 sm:border-t-0 sm:border-l sm:border-white/10 sm:px-6 sm:first:border-l-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p
        className={`mt-2 truncate font-display text-[1.2rem] font-semibold tracking-[-0.03em] tabular-nums sm:text-[1.35rem] ${
          accent ? "text-[#ff9a4a]" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-white/40">{hint}</p>
    </div>
  );
}
