export interface CreativeAnalyzerMetric {
  id: string;
  label: string;
  value: string;
  hint: string;
  badge?: string;
}

export interface CreativeSignal {
  id: string;
  label: string;
  score: number;
}

export interface CreativeWorkflowStep {
  id: string;
  step: number;
  title: string;
  description: string;
}

export interface CreativeValueItem {
  id: string;
  title: string;
  description: string;
  badge: string;
}

export interface CreativeAnalyzerMetrics {
  activeUsers: number;
  totalCreatives: number;
  winningCreatives: number;
  policyChecks: number;
  totalPolicyChecks: number;
  averageScore: number;
  topMetric: string;
}

export interface CreativeAnalyzerOverview {
  metrics: CreativeAnalyzerMetrics;
  stats: CreativeAnalyzerMetric[];
  creativeSignals: CreativeSignal[];
  workflowSteps: CreativeWorkflowStep[];
  features: CreativeValueItem[];
  benchmarkRecommendation: string;
}

/** @deprecated */
export interface AnalyzerStat {
  id: string;
  label: string;
  value: string;
}

/** @deprecated */
export interface AnalyzerFeature {
  id: string;
  title: string;
  description: string;
}
