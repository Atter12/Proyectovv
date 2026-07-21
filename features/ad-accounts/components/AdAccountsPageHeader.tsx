import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
}

export function AdAccountsPageHeader({ summary }: AdAccountsPageHeaderProps) {
  const hasActiveAccounts = summary.activeAccounts > 0;
  const hasAccounts = summary.totalAccounts > 0;

  return (
    <DashboardPageIntro
      description="Administra tus cuentas conectadas, presupuesto asignado y estado operativo desde un solo lugar."
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
    />
  );
}
