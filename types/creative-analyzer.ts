export interface AnalyzerStat {
  id: string;
  label: string;
  value: string;
}

export interface AnalyzerFeature {
  id: string;
  title: string;
  description: string;
}

export interface CreativeAnalyzerOverview {
  stats: AnalyzerStat[];
  features: AnalyzerFeature[];
}
