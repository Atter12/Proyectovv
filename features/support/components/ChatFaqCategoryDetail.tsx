import type { SupportArticle } from "../types/support.types";

interface ChatFaqCategoryDetailProps {
  categoryTitle: string;
  articles: SupportArticle[];
  onSelectArticle: (articleId: string) => void;
  onBack: () => void;
}

export function ChatFaqCategoryDetail({
  categoryTitle,
  articles,
  onSelectArticle,
  onBack,
}: ChatFaqCategoryDetailProps) {
  return (
    <div className="flex flex-col">
      <div className="bg-[#10344a] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex items-center gap-1 text-xs text-white/80 hover:text-white"
          aria-label="Volver"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <p className="text-sm font-semibold text-white">{categoryTitle}</p>
      </div>

      <div className="max-h-[420px] overflow-y-auto bg-white">
        <ul className="divide-y divide-slate-100">
          {articles.map((article) => (
            <li key={article.id}>
              <button
                type="button"
                onClick={() => onSelectArticle(article.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>{article.title}</span>
                <svg
                  className="h-4 w-4 shrink-0 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
