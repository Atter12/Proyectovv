import { Card } from "@/components/ui/Card";
import type { AnalyzerFeature } from "@/types/creative-analyzer";

interface AnalyzerValueGridProps {
  features: AnalyzerFeature[];
}

export function AnalyzerValueGrid({ features }: AnalyzerValueGridProps) {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">
        Valores fundamentales
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.id}>
            <h3 className="text-sm font-semibold text-slate-900">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm text-slate-500">{feature.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
