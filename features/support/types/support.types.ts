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
}

export interface SupportConfig {
  brandName: string;
  poweredByLabel: string;
  whatsappUrl: string;
  initialMessages: ChatMessage[];
  categories: SupportCategory[];
  articles: SupportArticle[];
}
