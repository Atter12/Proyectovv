export type AssistantMetric = {
  label: string;
  value: string;
};

export type AssistantSource = {
  label: string;
  detail: string;
};

export type AssistantTable = {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string>[];
  caption?: string;
};

export type AssistantBlock = {
  id: string;
  title: string;
  text: string;
  metrics?: AssistantMetric[];
  table?: AssistantTable;
  sources: AssistantSource[];
};

export type AssistantResponse = {
  reply: string;
  today: string;
  blocks: AssistantBlock[];
};
