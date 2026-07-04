import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import type { CreativeAnalyzerOverview } from "@/types/creative-analyzer";
import { creativeAnalyzerMock } from "@/mocks/creative-analyzer.mock";

interface CreativeResultRow {
  overall_score: number | null;
  clarity_score: number | null;
  brand_score: number | null;
  compliance_score: number | null;
  recommendations: unknown;
  detected_issues: unknown;
  created_at: string;
}

export async function getCreativeAnalyzerOverview(
  session: SessionUser,
): Promise<CreativeAnalyzerOverview> {
  const organizationId = session.organizationId;
  if (!organizationId) {
    return emptyCreativeOverview();
  }

  const supabase = await createClient();

  const [assetsRes, jobsRes, resultsRes] = await Promise.all([
    supabase
      .from("creative_assets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("creative_analysis_jobs")
      .select("id, status")
      .eq("organization_id", organizationId),
    supabase
      .from("creative_analysis_results")
      .select(
        "overall_score, clarity_score, brand_score, compliance_score, recommendations, detected_issues, created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const totalCreatives = assetsRes.count ?? 0;
  const jobs = jobsRes.data ?? [];
  const results = (resultsRes.data ?? []) as CreativeResultRow[];
  const completedJobs = jobs.filter((job) => job.status === "completed").length;
  const policyChecks = results.filter(
    (result) => Number(result.compliance_score ?? 0) >= 80,
  ).length;

  const averageScore =
    results.length > 0
      ? Math.round(
          results.reduce(
            (sum, row) => sum + Number(row.overall_score ?? 0),
            0,
          ) / results.length,
        )
      : 0;

  const latest = results[0];

  return {
    metrics: {
      activeUsers: 1,
      totalCreatives,
      winningCreatives: completedJobs,
      policyChecks,
      totalPolicyChecks: results.length,
      averageScore,
      topMetric: totalCreatives > 0 ? "ROAS" : "—",
    },
    stats: [
      {
        id: "active-users",
        label: "Usuarios activos",
        value: "1",
        hint: "Tu organización",
        badge: totalCreatives > 0 ? "En vivo" : undefined,
      },
      {
        id: "total-creatives",
        label: "Creativos totales",
        value: String(totalCreatives),
        hint: totalCreatives > 0 ? "Piezas en biblioteca" : "Aún no hay creativos",
      },
      {
        id: "winning-creatives",
        label: "Análisis completados",
        value: String(completedJobs),
        hint: "Análisis finalizados",
        badge: completedJobs > 0 ? "Ganadores" : undefined,
      },
      {
        id: "policy-checks",
        label: "Controles de políticas",
        value: `${policyChecks} / ${results.length}`,
        hint: "Creativos con cumplimiento alto",
        badge: results.length > 0 ? "Políticas" : undefined,
      },
    ],
    creativeSignals: latest
      ? [
          {
            id: "clarity",
            label: "Claridad del mensaje",
            score: Number(latest.clarity_score ?? 0),
          },
          {
            id: "brand",
            label: "Alineación de marca",
            score: Number(latest.brand_score ?? 0),
          },
          {
            id: "compliance",
            label: "Seguridad de políticas",
            score: Number(latest.compliance_score ?? 0),
          },
          {
            id: "overall",
            label: "Puntuación general",
            score: Number(latest.overall_score ?? 0),
          },
        ]
      : creativeAnalyzerMock.creativeSignals.map((signal) => ({
          ...signal,
          score: 0,
        })),
    workflowSteps: creativeAnalyzerMock.workflowSteps,
    features: creativeAnalyzerMock.features,
    benchmarkRecommendation:
      totalCreatives > 0
        ? "Sube más variaciones para comparar benchmarks con datos reales."
        : "Aún no hay creativos analizados. Sube tu primera pieza para comenzar.",
  };
}

function emptyCreativeOverview(): CreativeAnalyzerOverview {
  return {
    ...creativeAnalyzerMock,
    metrics: {
      activeUsers: 0,
      totalCreatives: 0,
      winningCreatives: 0,
      policyChecks: 0,
      totalPolicyChecks: 0,
      averageScore: 0,
      topMetric: "—",
    },
    stats: creativeAnalyzerMock.stats.map((stat) => ({
      ...stat,
      value: "0",
      hint: "Sin datos todavía",
      badge: undefined,
    })),
    creativeSignals: creativeAnalyzerMock.creativeSignals.map((signal) => ({
      ...signal,
      score: 0,
    })),
    benchmarkRecommendation:
      "Aún no hay creativos analizados. Sube tu primera pieza para comenzar.",
  };
}
