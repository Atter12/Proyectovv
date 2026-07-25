import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
import { AdAccountsOpenCreateModalButton } from "./AdAccountsOpenCreateModalButton.client";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
}

export function AdAccountsPageHeader({ summary }: AdAccountsPageHeaderProps) {
  const hasActiveAccounts = summary.activeAccounts > 0;
  const hasAccounts = summary.totalAccounts > 0;

  return (
    <DashboardPageIntro
      description="Administra las cuentas publicitarias de tu organización: presupuesto, estado y operación en un solo lugar."
      badges={
        <>
          {hasAccounts ? (
            <Badge variant="info" className="px-3 py-1">
              {summary.totalAccounts} cuenta{summary.totalAccounts === 1 ? "" : "s"}
            </Badge>
          ) : (
            <Badge variant="default" className="px-3 py-1">
              Sin cuentas
            </Badge>
          )}
          {!hasActiveAccounts && (
            <Badge variant="default" className="px-3 py-1">
              Sin cuentas activas
            </Badge>
          )}
        </>
      }
      actions={
        <AdAccountsOpenCreateModalButton className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-10 sm:w-auto">
          Crear cuenta
        </AdAccountsOpenCreateModalButton>
      }
    />
  );
}
