import type { SupportArticle } from "../types/support.types";

interface ChatFaqArticleDetailProps {
  article: SupportArticle;
  onBack: () => void;
}

export function ChatFaqArticleDetail({ article, onBack }: ChatFaqArticleDetailProps) {
  return (
    <div className="flex flex-col">
      <div className="bg-[#10344a] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex items-center gap-1 text-xs text-white/80 hover:text-white"
          aria-label="Volver a la categoría"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <p className="text-sm font-semibold text-white">{article.title}</p>
      </div>

      <div className="max-h-[380px] overflow-y-auto bg-white p-4">
        <p className="text-sm leading-relaxed text-slate-600">{article.content}</p>
        {article.bullets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {article.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2 text-sm text-slate-600">
                <span className="text-[#4056ff]">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-center text-sm font-medium text-slate-700">
            Was this article useful?
          </p>
          <div className="mt-3 flex justify-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
              aria-label="Artículo útil"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.278 2.101-.783M6.633 10.25c-.806 0-1.533.278-2.101.783M6.633 10.25l-1.45-4.35A1.125 1.125 0 005.25 4.5h13.5c.621 0 1.125.504 1.125 1.125v.008c0 .621-.504 1.125-1.125 1.125H6.633zM16.5 10.25V18a2.25 2.25 0 01-2.25 2.25H9.75A2.25 2.25 0 017.5 18v-7.75m9 0V6.375c0-.621-.504-1.125-1.125-1.125H7.875c-.621 0-1.125.504-1.125 1.125v3.875m9 0h-9" />
              </svg>
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              aria-label="Artículo no útil"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.859-.815-1.859-1.82v-.742c0-1.006.833-1.82 1.86-1.82H7.5v-2.25a2.25 2.25 0 012.25-2.25h4.5A2.25 2.25 0 0116.5 6.75v2.25h3.128c1.026 0 1.86.814 1.86 1.82v.742c0 1.005-.834 1.82-1.86 1.82H16.5v2.25a2.25 2.25 0 01-2.25 2.25h-4.5a2.25 2.25 0 01-2.25-2.25v-2.25z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
