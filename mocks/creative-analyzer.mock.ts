import type { CreativeAnalyzerOverview } from "@/types/creative-analyzer";

export const creativeAnalyzerMock: CreativeAnalyzerOverview = {
  metrics: {
    activeUsers: 170,
    totalCreatives: 295,
    winningCreatives: 156,
    policyChecks: 34,
    totalPolicyChecks: 128,
    averageScore: 87,
    topMetric: "ROAS",
  },
  stats: [
    {
      id: "active-users",
      label: "Usuarios activos",
      value: "170",
      hint: "Equipos usando el analizador",
      badge: "En vivo",
    },
    {
      id: "total-creatives",
      label: "Creativos totales",
      value: "295",
      hint: "Piezas analizadas",
    },
    {
      id: "winning-creatives",
      label: "Creativos ganadores",
      value: "156",
      hint: "Detectados por señales de rendimiento",
      badge: "Ganadores",
    },
    {
      id: "policy-checks",
      label: "Controles de políticas",
      value: "34 / 128",
      hint: "34 seguros / 128 revisados",
      badge: "Políticas",
    },
  ],
  creativeSignals: [
    { id: "hook", label: "Fuerza del gancho", score: 92 },
    { id: "retention", label: "Señal de retención", score: 81 },
    { id: "cta", label: "Claridad del CTA", score: 76 },
    { id: "policy", label: "Cumplimiento de políticas", score: 96 },
  ],
  workflowSteps: [
    {
      id: "upload",
      step: 1,
      title: "Sube tu video",
      description: "Carga una pieza creativa o conecta una campaña de prueba.",
    },
    {
      id: "detect",
      step: 2,
      title: "Detectamos señales",
      description:
        "Analizamos gancho, ritmo visual, claridad del mensaje y retención.",
    },
    {
      id: "benchmark",
      step: 3,
      title: "Comparamos referencias",
      description:
        "Contrastamos tus métricas con patrones de alto rendimiento.",
    },
    {
      id: "actions",
      step: 4,
      title: "Generamos acciones",
      description: "Recibe puntuación, recomendaciones y guiones alternativos.",
    },
  ],
  features: [
    {
      id: "multi-layer",
      title: "Analizador creativo multicapa",
      description:
        "Evalúa ganchos, narrativa, ritmo visual y señales de retención en un solo flujo.",
      badge: "Con IA",
    },
    {
      id: "real-time",
      title: "Análisis en tiempo real",
      description:
        "Obtén puntuaciones y recomendaciones mientras subes tus creatividades.",
      badge: "En vivo",
    },
    {
      id: "benchmark",
      title: "Datos de referencia integrados",
      description:
        "Compara tus anuncios contra referencias del sector y mejores performers.",
      badge: "Referencia",
    },
    {
      id: "ai-scripts",
      title: "Generador de guiones con IA",
      description:
        "Genera variaciones de guion basadas en creativos de alto rendimiento.",
      badge: "Guiones IA",
    },
    {
      id: "policy",
      title: "Verificación automática de políticas",
      description:
        "Detecta riesgos de cumplimiento antes de publicar tus campañas.",
      badge: "Políticas",
    },
    {
      id: "performance",
      title: "Diseñado para rendimiento",
      description:
        "Prioriza métricas que impactan CPA, ROAS y escalado de presupuesto.",
      badge: "Rendimiento",
    },
  ],
  benchmarkRecommendation:
    "Prueba 3 variaciones de gancho antes de escalar el presupuesto.",
};
