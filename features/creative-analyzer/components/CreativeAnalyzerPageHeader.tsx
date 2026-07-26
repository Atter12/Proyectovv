import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";

export function CreativeAnalyzerPageHeader() {
  return (
    <DashboardPageIntro
      description="Fichas y proyectos del cliente + subí piezas para encolar análisis antes de escalar campañas."
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
