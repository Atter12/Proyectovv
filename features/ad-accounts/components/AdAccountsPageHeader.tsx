import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
}

export function AdAccountsPageHeader({ summary }: AdAccountsPageHeaderProps) {
  const hasActiveAccounts = summary.activeAccounts > 0;

  return (
    <DashboardPageIntro
      description="Administra tus cuentas conectadas, presupuesto asignado y estado operativo desde un solo lugar."
      badges={
        <>
          <Badge variant="info" className="px-3 py-1">
            Datos de ejemplo
          </Badge>
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
