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


export interface CreativeAnalysisActivityItem {
  id: string;
  assetId: string | null;
  assetName: string;
  status: "queued" | "pending" | "processing" | "completed" | "failed";
  provider: string;
  createdAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
}

export interface CreativeAnalyzerOverview {
  metrics: CreativeAnalyzerMetrics;
  stats: CreativeAnalyzerMetric[];
  creativeSignals: CreativeSignal[];
  workflowSteps: CreativeWorkflowStep[];
  features: CreativeValueItem[];
  benchmarkRecommendation: string;
  recentActivity?: CreativeAnalysisActivityItem[];
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
