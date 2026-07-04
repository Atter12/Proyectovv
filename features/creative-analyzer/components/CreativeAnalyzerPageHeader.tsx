import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";

export function CreativeAnalyzerPageHeader() {
  return (
    <DashboardPageIntro
      description="Evalúa creatividades, detecta patrones ganadores y genera recomendaciones antes de escalar campañas."
      badges={
        <>
          <Badge variant="info" className="px-3 py-1">
            Laboratorio creativo IA
          </Badge>
          <Badge variant="default" className="px-3 py-1">
            Datos de ejemplo
          </Badge>
        </>
      }
    />
  );
}
