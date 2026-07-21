import type { SupportCategory } from "../types/support.types";

interface ChatFaqCategoriesProps {
  brandName: string;
  categories: SupportCategory[];
  onSelectCategory: (categoryId: string) => void;
  onBack: () => void;
}

export function ChatFaqCategories({
  brandName,
  categories,
  onSelectCategory,
  onBack,
}: ChatFaqCategoriesProps) {
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
          Volver
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-white">
            DM
          </div>
          <span className="text-sm font-semibold text-white">{brandName}</span>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto bg-white p-4">
        <input
          type="search"
          placeholder="Buscar preguntas frecuentes..."
          aria-label="Buscar en FAQs"
          className="mb-4 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
        />
        <ul className="space-y-1">
          {categories.map((category, index) => (
            <li key={category.id}>
              <button
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>
                  {index + 1}. {category.title}
                </span>
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
