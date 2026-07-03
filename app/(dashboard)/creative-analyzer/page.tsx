import { CreativeHero } from "@/features/creative-analyzer/components/CreativeHero";
import { AnalyzerStatsGrid } from "@/features/creative-analyzer/components/AnalyzerStatsGrid";
import { AnalyzerValueGrid } from "@/features/creative-analyzer/components/AnalyzerValueGrid";
import { AnalyzerCtaSection } from "@/features/creative-analyzer/components/AnalyzerCtaSection";
import { getCreativeAnalyzerOverview } from "@/services/creative-analyzer.mock.service";

export default async function CreativeAnalyzerPage() {
  const data = await getCreativeAnalyzerOverview();

  return (
    <div className="space-y-8">
      <CreativeHero />
      <AnalyzerStatsGrid stats={data.stats} />
      <AnalyzerValueGrid features={data.features} />
      <AnalyzerCtaSection />
    </div>
  );
}
