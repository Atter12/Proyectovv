import type { CreativeAnalyzerOverview } from "@/types/creative-analyzer";

export const creativeAnalyzerMock: CreativeAnalyzerOverview = {
  stats: [
    { id: "active-users", label: "Usuarios activos", value: "170" },
    { id: "total-creatives", label: "Creativos totales", value: "295" },
    { id: "winning-creatives", label: "Creativos ganadores", value: "156" },
    { id: "policy-checks", label: "Controles de políticas", value: "34 / 128" },
  ],
  features: [
    {
      id: "multi-layer",
      title: "Analizador creativo multicapa",
      description: "Evalúa hooks, narrativa, ritmo visual y señales de retención en un solo flujo.",
    },
    {
      id: "real-time",
      title: "Análisis en tiempo real",
      description: "Obtén puntuaciones y recomendaciones mientras subes tus creatividades.",
    },
    {
      id: "benchmark",
      title: "Datos de referencia integrados",
      description: "Compara tus anuncios contra benchmarks del sector y top performers.",
    },
    {
      id: "ai-scripts",
      title: "Generador de guiones de IA",
      description: "Genera variaciones de guion basadas en creativos de alto rendimiento.",
    },
    {
      id: "policy",
      title: "Verificación automática de políticas",
      description: "Detecta riesgos de cumplimiento antes de publicar tus campañas.",
    },
    {
      id: "performance",
      title: "Diseñado para performance",
      description: "Prioriza métricas que impactan CPA, ROAS y escalado de presupuesto.",
    },
  ],
};
