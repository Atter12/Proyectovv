"use client";

import { useTranslations } from "next-intl";
import type { SupportArticle } from "../types/support.types";

interface ChatFaqArticleDetailProps {
  article: SupportArticle;
  onBack: () => void;
}

export function ChatFaqArticleDetail({ article, onBack }: ChatFaqArticleDetailProps) {
  const t = useTranslations("support");

  return (
    <div className="flex flex-col">
      <div className="bg-[linear-gradient(135deg,#050505_0%,#1a1008_70%,#e8451a_160%)] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex items-center gap-1 text-xs text-white/80 hover:text-white"
          aria-label={t("back")}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          {t("back")}
        </button>
        <p className="text-sm font-semibold text-white">{article.title}</p>
      </div>

      <div className="max-h-[380px] overflow-y-auto bg-white p-4">
        <p className="text-sm leading-relaxed text-[#6b645c]">{article.content}</p>
        {article.bullets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {article.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-sm text-[#6b645c]">
                <span className="shrink-0 text-[var(--brand-primary)]">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
