import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { CreativeAnalysisActivityItem } from "@/types/creative-analyzer";

const statusLabels: Record<CreativeAnalysisActivityItem["status"], string> = {
  queued: "En cola",
  pending: "Pendiente",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
};

const statusVariants: Record<CreativeAnalysisActivityItem["status"], "success" | "warning" | "default" | "info"> = {
  queued: "info",
  pending: "warning",
  processing: "info",
  completed: "success",
  failed: "warning",
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CreativeAnalysisActivityProps {
  items: CreativeAnalysisActivityItem[];
}

export function CreativeAnalysisActivity({ items }: CreativeAnalysisActivityProps) {
  return (
    <section>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#0f172a]">
          Historial de análisis
        </h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Jobs creados desde el dashboard del cliente.
        </p>
      </div>

      <Card padding="none" className="overflow-hidden">
        {items.length === 0 ? (
          <div className="p-6 text-sm text-[#64748b]">
            Todavía no hay creativos subidos. Usa el panel de carga para crear
            el primer job.
          </div>
        ) : (
          <div className="divide-y divide-[#eef2f7]">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#0f172a]">
                    {item.assetName}
                  </p>
                  <p className="mt-1 text-xs text-[#64748b]">
                    Provider: {item.provider} · Creado: {formatDate(item.createdAt)}
                  </p>
                  {item.errorMessage && (
                    <p className="mt-1 text-xs text-[#b91c1c]">{item.errorMessage}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={statusVariants[item.status]}>
                    {statusLabels[item.status]}
                  </Badge>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-[#64748b]">
                    {item.id.slice(0, 8)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
