import { creativeAnalyzerMock } from "@/mocks/creative-analyzer.mock";
import type { CreativeAnalyzerOverview } from "@/types/creative-analyzer";

export async function getCreativeAnalyzerOverview(): Promise<CreativeAnalyzerOverview> {
  return creativeAnalyzerMock;
}
