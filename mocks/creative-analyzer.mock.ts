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
      badge: "Live",
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
      hint: "Detectados por señales de performance",
      badge: "Winners",
    },
    {
      id: "policy-checks",
      label: "Controles de políticas",
      value: "34 / 128",
      hint: "34 seguros / 128 revisados",
      badge: "Policy",
    },
  ],
  creativeSignals: [
    { id: "hook", label: "Hook strength", score: 92 },
    { id: "retention", label: "Retention signal", score: 81 },
    { id: "cta", label: "CTA clarity", score: 76 },
    { id: "policy", label: "Policy safety", score: 96 },
  ],
  workflowSteps: [
    {
      id: "upload",
      step: 1,
      title: "Sube tu video",
      description: "Carga una pieza creativa o conecta una campaña mock.",
    },
    {
      id: "detect",
      step: 2,
      title: "Detectamos señales",
      description:
        "Analizamos hook, ritmo visual, claridad del mensaje y retención.",
    },
    {
      id: "benchmark",
      step: 3,
      title: "Comparamos benchmarks",
      description:
        "Contrastamos tus métricas con patrones de alto rendimiento.",
    },
    {
      id: "actions",
      step: 4,
      title: "Generamos acciones",
      description: "Recibe score, recomendaciones y guiones alternativos.",
    },
  ],
  features: [
    {
      id: "multi-layer",
      title: "Analizador creativo multicapa",
      description:
        "Evalúa hooks, narrativa, ritmo visual y señales de retención en un solo flujo.",
      badge: "AI powered",
    },
    {
      id: "real-time",
      title: "Análisis en tiempo real",
      description:
        "Obtén puntuaciones y recomendaciones mientras subes tus creatividades.",
      badge: "Live",
    },
    {
      id: "benchmark",
      title: "Datos de referencia integrados",
      description:
        "Compara tus anuncios contra benchmarks del sector y top performers.",
      badge: "Benchmark",
    },
    {
      id: "ai-scripts",
      title: "Generador de guiones de IA",
      description:
        "Genera variaciones de guion basadas en creativos de alto rendimiento.",
      badge: "Script lab",
    },
    {
      id: "policy",
      title: "Verificación automática de políticas",
      description:
        "Detecta riesgos de cumplimiento antes de publicar tus campañas.",
      badge: "Policy",
    },
    {
      id: "performance",
      title: "Diseñado para performance",
      description:
        "Prioriza métricas que impactan CPA, ROAS y escalado de presupuesto.",
      badge: "Performance",
    },
  ],
  benchmarkRecommendation:
    "Test 3 hook variations before scaling budget.",
};
