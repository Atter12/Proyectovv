import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
import type { AffiliateProgramOverview } from "@/types/affiliate";

interface AffiliatesPageHeaderProps {
  data: AffiliateProgramOverview;
}

export function AffiliatesPageHeader({ data }: AffiliatesPageHeaderProps) {
  return (
    <DashboardPageIntro
      description="Comparte tu enlace, invita anunciantes y gana comisiones por el gasto publicitario de tus referidos."
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
