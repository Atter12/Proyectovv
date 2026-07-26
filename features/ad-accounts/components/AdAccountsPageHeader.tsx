import Link from "next/link";
import { routes } from "@/config/routes";
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

export function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  clienteId,
  avatarUrl,
  hideCreate = false,
}: AdAccountsPageHeaderProps) {
  const description = hecomScoped
    ? `Cuentas TikTok Ads vinculadas a ${clienteName ?? "este cliente"} desde Hecom Club.`
    : "Elegí un cliente en Clientes para ver únicamente sus cuentas publicitarias.";

  const kpis = [
    {
      label: "Totales",
      value: formatNumber(summary.totalAccounts),
      hint: "Mapeadas en Hecom",
      accent: "bg-[#8a8178]",
      tone: "text-[#1a1612]",
    },
    {
      label: "Activas",
      value: formatNumber(summary.activeAccounts),
      hint: "Listas para gastar",
      accent: "bg-[#2f7a57]",
      tone: "text-[#1f5c40]",
    },
    {
      label: "Saldo asignado",
      value: formatMoney(summary.assignedBalance),
      hint: "Disponible en cuentas",
      accent: "bg-[#c45a18]",
      tone: "text-[#1a1612]",
    },
    {
      label: "Pendientes",
      value: formatNumber(summary.pendingSetup),
      hint: "Falta configuración",
      accent: "bg-[#b45309]",
      tone: summary.pendingSetup > 0 ? "text-[#92400e]" : "text-[#1a1612]",
    },
  ];

  return (
    <header className="overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
      <div className="relative px-5 py-5 sm:px-6 sm:py-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.06),transparent)]"
        />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a5a38]">
              Publicidad
            </p>
            <h1 className="mt-1.5 text-[1.35rem] font-medium leading-snug tracking-[-0.015em] text-[#1a1612] sm:text-[1.45rem]">
              Mis cuentas publicitarias
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
              {description}
            </p>

            {hecomScoped && clienteName ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <HecomClienteAvatar
                    name={clienteName}
                    avatarUrl={avatarUrl}
                    size="sm"
                    className="ring-1 ring-white shadow-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[#1a1612]">
                      {clienteName}
                    </p>
                    <p className="text-[11px] tabular-nums text-[#7a736a]">
                      {summary.totalAccounts} cuenta
                      {summary.totalAccounts === 1 ? "" : "s"}
                      {summary.activeAccounts > 0
                        ? ` · ${summary.activeAccounts} activa${summary.activeAccounts === 1 ? "" : "s"}`
                        : summary.totalAccounts > 0
                          ? " · sin activas"
                          : ""}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#16161a] px-2 py-0.5 text-[11px] font-medium text-[#f5f5f5]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#fe2c55]" />
                  TikTok Ads
                </span>
                {clienteId ? (
                  <Link
                    href={`/clientes/${clienteId}`}
                    className="text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
                  >
                    Ver ficha
                  </Link>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-[12px] tabular-nums text-[#7a736a]">
                {summary.totalAccounts} cuenta
                {summary.totalAccounts === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {hideCreate ? null : (
            <AdAccountsOpenCreateModalButton className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-lg bg-[#e85a1c] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#d14e16] sm:w-auto">
              Crear cuenta
            </AdAccountsOpenCreateModalButton>
          )}
        </div>

        <p className="relative mt-4 border-t border-[rgb(20_18_16_/_0.06)] pt-3 text-[12px] leading-5 text-[#7a736a]">
          Para publicar, la cuenta necesita saldo en cartera.{" "}
          <Link
            href={routes.payments}
            className="font-medium text-[#c45a18] underline-offset-2 hover:underline"
          >
            Ir a pagos
          </Link>
        </p>
      </div>

      <div
        aria-label="Resumen de cuentas"
        className="border-t border-[rgb(20_18_16_/_0.07)] bg-[#faf7f3]"
      >
        <div className="grid sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((item, index) => (
            <div
              key={item.label}
              className={`relative px-4 py-3.5 sm:px-5 ${
                index % 2 === 0
                  ? "sm:border-r sm:border-[rgb(20_18_16_/_0.06)]"
                  : ""
              } ${
                index < 2
                  ? "border-b border-[rgb(20_18_16_/_0.06)] xl:border-b-0"
                  : ""
              } ${
                index < kpis.length - 1
                  ? "xl:border-r xl:border-[rgb(20_18_16_/_0.06)]"
                  : ""
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${item.accent}`}
              />
              <p className="pl-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
                {item.label}
              </p>
              <p
                className={`mt-1 truncate pl-2 text-[1.15rem] font-medium tracking-[-0.015em] tabular-nums sm:text-[1.25rem] ${item.tone}`}
              >
                {item.value}
              </p>
              <p className="mt-0.5 pl-2 text-[11px] text-[#8a8178]">{item.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
