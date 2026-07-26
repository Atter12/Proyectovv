import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
import type { AffiliateProgramOverview } from "@/types/affiliate";

interface AffiliatesPageHeaderProps {
  data: AffiliateProgramOverview;
}

export function AffiliatesPageHeader({ data }: AffiliatesPageHeaderProps) {
  return (
    <DashboardPageIntro
      description="Programa de afiliados (si aplica). No es el core de ads ni de pagos."
      badges={
        <>
          <Badge variant="info" className="px-3 py-1">
            Datos de ejemplo
          </Badge>
          <Badge variant="default" className="px-3 py-1">
            {data.stats.activeReferrals} referidos activos
          </Badge>
        </>
      }
    />
  );
}
