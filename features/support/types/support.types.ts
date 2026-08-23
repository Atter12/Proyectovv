export type SupportView =
  | "closed"
  | "home"
  | "conversation"
  | "faqCategories"
  | "faqCategoryDetail"
  | "faqArticleDetail";

export interface SupportCategory {
  id: string;
  title: string;
  articleIds: string[];
}

export interface SupportArticle {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  bullets: string[];
  /** cliente | gerente | all (default all) */
  audience?: "cliente" | "gerente" | "all";
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  path: string;
  bucket: string;
  size: number;
  url?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  /** Etiqueta visible estilo Whaticket (Cliente / nombre del agente). */
  senderName?: string | null;
  senderKind?: "client" | "agent" | "system";
}

export interface SupportConfig {
  brandName: string;
  poweredByLabel: string;
  whatsappUrl: string;
  initialMessages: ChatMessage[];
  categories: SupportCategory[];
  articles: SupportArticle[];
}
