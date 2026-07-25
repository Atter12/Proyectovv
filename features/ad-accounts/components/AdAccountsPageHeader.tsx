import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
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
    <DashboardPageIntro
      description={description}
      badges={
        <>
          {hecomScoped && clienteName ? (
            <Badge variant="info" className="px-3 py-1">
              {clienteName}
            </Badge>
          ) : null}
          {hasAccounts ? (
            <Badge variant="info" className="px-3 py-1">
              {summary.totalAccounts} cuenta{summary.totalAccounts === 1 ? "" : "s"}
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
        </>
      }
      actions={
        hideCreate ? null : (
          <AdAccountsOpenCreateModalButton className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-10 sm:w-auto">
            Crear cuenta
          </AdAccountsOpenCreateModalButton>
        )
      }
    />
  );
}
