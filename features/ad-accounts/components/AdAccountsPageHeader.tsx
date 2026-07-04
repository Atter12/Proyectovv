import { Badge } from "@/components/ui/Badge";
import type { AdAccountsSummary } from "@/types/ad-account";

interface AdAccountsPageHeaderProps {
  summary: AdAccountsSummary;
}

export function AdAccountsPageHeader({ summary }: AdAccountsPageHeaderProps) {
  const hasActiveAccounts = summary.activeAccounts > 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="max-w-2xl text-sm leading-relaxed text-[#64748b]">
          Administra tus cuentas conectadas, presupuesto asignado y estado
          operativo desde un solo lugar.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Badge variant="info" className="px-3 py-1">
          Modo mock
        </Badge>
        {!hasActiveAccounts && (
          <Badge variant="default" className="px-3 py-1">
            Sin cuentas activas
          </Badge>
        )}
      </div>
    </div>
  );
}
