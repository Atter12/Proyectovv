import { Badge } from "@/components/ui/Badge";
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
  const hasActiveAccounts = summary.activeAccounts > 0;
  const hasAccounts = summary.totalAccounts > 0;

  const description = hecomScoped
    ? `Solo cuentas publicitarias de ${clienteName ?? "este cliente"} (Hecom Club).`
    : "Elegí un cliente en Clientes para ver únicamente sus cuentas publicitarias.";

  return (
    <div className="dashboard-surface-card flex flex-col gap-4 rounded-[1.5rem] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-deep)]">
          Cuentas publicitarias
        </p>
        <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[#6b645c]">
          {description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {hecomScoped && clienteName ? (
            <Badge variant="info" className="px-3 py-1">
              {clienteName}
            </Badge>
          ) : null}
          {hasAccounts ? (
            <Badge variant="info" className="px-3 py-1">
              {summary.totalAccounts} cuenta
              {summary.totalAccounts === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge variant="default" className="px-3 py-1">
              Sin cuentas
            </Badge>
          )}
          {!hasActiveAccounts && hasAccounts ? (
            <Badge variant="default" className="px-3 py-1">
              Sin cuentas activas
            </Badge>
          ) : null}
        </div>
      </div>
      {hideCreate ? null : (
        <AdAccountsOpenCreateModalButton className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-[0_10px_28px_rgb(255_120_31_/_0.32)] transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-10 sm:w-auto">
          Crear cuenta
        </AdAccountsOpenCreateModalButton>
      )}
    </div>
  );
}
