import { Badge } from "@/components/ui/Badge";

export function CreativeAnalyzerPageHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-[#0f172a] sm:text-2xl">
          Analizador creativo
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#64748b]">
          Evalúa creatividades, detecta patrones ganadores y genera
          recomendaciones antes de escalar campañas.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Badge variant="info" className="px-3 py-1">
          AI Creative Lab
        </Badge>
        <Badge variant="default" className="px-3 py-1">
          Modo mock
        </Badge>
      </div>
    </div>
  );
}
