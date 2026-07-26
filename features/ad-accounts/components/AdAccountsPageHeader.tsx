import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
  hecomScoped?: boolean;
  clienteName?: string;
  hideCreate?: boolean;
}

export function AdAccountsPageHeader({
  summary,
  hecomScoped = false,
  clienteName,
  hideCreate = false,
}: AdAccountsPageHeaderProps) {
  const description = hecomScoped
    ? `Cuentas TikTok Ads vinculadas a ${clienteName ?? "este cliente"} desde Hecom Club.`
    : "Elegí un cliente en Clientes para ver únicamente sus cuentas publicitarias.";

  return (
    <header className="relative overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[linear-gradient(165deg,#fffdfb_0%,#f7f1ea_55%,#f3ebe2_100%)] px-5 py-5 sm:px-6 sm:py-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#ff4d2d_0%,#ff781f_55%,#c45a18_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgb(255_120_31_/_0.1),transparent_68%)]"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a5a38]">
            Publicidad
          </p>
          <h1 className="mt-1.5 text-[1.35rem] font-medium leading-snug tracking-[-0.01em] text-[#1a1612] sm:text-[1.5rem]">
            Mis cuentas publicitarias
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#6b645c]">
            {description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[#7a736a]">
            {hecomScoped && clienteName ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff781f]" />
                {clienteName}
              </span>
            ) : null}
            <span className="tabular-nums">
              {summary.totalAccounts} cuenta
              {summary.totalAccounts === 1 ? "" : "s"}
              {summary.activeAccounts > 0
                ? ` · ${summary.activeAccounts} activa${summary.activeAccounts === 1 ? "" : "s"}`
                : summary.totalAccounts > 0
                  ? " · sin activas"
                  : ""}
            </span>
            {hecomScoped ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-[rgb(20_18_16_/_0.1)] bg-[#16161a] px-2 py-0.5 text-[11px] font-medium text-[#f5f5f5]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#fe2c55]" />
                TikTok Ads
              </span>
            ) : null}
          </div>
        </div>

        {hideCreate ? null : (
          <AdAccountsOpenCreateModalButton className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[#e85a1c] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[#d14e16] sm:h-10 sm:w-auto">
            Crear cuenta
          </AdAccountsOpenCreateModalButton>
        )}
      </div>
    </header>
  );
}
