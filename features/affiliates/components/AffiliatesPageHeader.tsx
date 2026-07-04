import { Badge } from "@/components/ui/Badge";
import type { AffiliateProgramOverview } from "@/types/affiliate";

interface AffiliatesPageHeaderProps {
  data: AffiliateProgramOverview;
}

export function AffiliatesPageHeader({ data }: AffiliatesPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="max-w-2xl text-sm leading-relaxed text-[#64748b]">
          Comparte tu enlace, invita anunciantes y gana comisiones por el gasto
          publicitario de tus referidos.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Badge variant="info" className="px-3 py-1">
          Datos de ejemplo
        </Badge>
        <Badge variant="default" className="px-3 py-1">
          {data.stats.activeReferrals} referidos activos
        </Badge>
      </div>
    </div>
  );
}
