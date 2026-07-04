import { CreativeAnalyzerPageHeader } from "@/features/creative-analyzer/components/CreativeAnalyzerPageHeader";
import { CreativeAnalyzerHero } from "@/features/creative-analyzer/components/CreativeAnalyzerHero";
import { CreativeAnalyzerStats } from "@/features/creative-analyzer/components/CreativeAnalyzerStats";
import { CreativeAnalysisWorkflow } from "@/features/creative-analyzer/components/CreativeAnalysisWorkflow";
import { CreativeBenchmarkPanel } from "@/features/creative-analyzer/components/CreativeBenchmarkPanel";
import { CreativeValueGrid } from "@/features/creative-analyzer/components/CreativeValueGrid";
import { CreativeAnalyzerCTA } from "@/features/creative-analyzer/components/CreativeAnalyzerCTA";
import { requirePermission } from "@/lib/auth/guards.server";
import { getCreativeAnalyzerOverview } from "@/services/creative-analyzer.service";

export default async function CreativeAnalyzerPage() {
  const session = await requirePermission("creativeAnalyzer:read");
  const data = await getCreativeAnalyzerOverview(session);

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8 lg:space-y-10">
      <CreativeAnalyzerPageHeader />
      <CreativeAnalyzerHero metrics={data.metrics} />
      <CreativeAnalyzerStats stats={data.stats} />
      <CreativeAnalysisWorkflow steps={data.workflowSteps} />
      <CreativeBenchmarkPanel
        metrics={data.metrics}
        signals={data.creativeSignals}
        recommendation={data.benchmarkRecommendation}
      />
      <CreativeValueGrid features={data.features} />
      <CreativeAnalyzerCTA />
    </div>
  );
}
