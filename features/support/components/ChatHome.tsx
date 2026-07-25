import type { SupportCategory } from "../types/support.types";

interface ChatHomeProps {
  brandName: string;
  poweredByLabel: string;
  categories: SupportCategory[];
  onOpenConversation: () => void;
  onOpenFaqCategories: () => void;
  onSelectCategory: (categoryId: string) => void;
}

export function ChatHome({
  brandName,
  poweredByLabel,
  categories,
  onOpenConversation,
  onOpenFaqCategories,
  onSelectCategory,
}: ChatHomeProps) {
  return (
    <div className="flex flex-col">
      <div className="bg-[linear-gradient(135deg,#050505_0%,#1a1008_60%,#e8451a_140%)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-white">
            HM
          </div>
          <span className="text-sm font-semibold text-white">{brandName}</span>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto bg-white">
        <div className="border-b border-[var(--border-subtle)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">
            Chatea con nosotros
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenConversation}
          className="w-full border-b border-[var(--border-subtle)] px-4 py-4 text-left transition-colors hover:bg-[var(--surface-soft)]"
        >
          <p className="text-sm font-bold text-[#141210]">Escríbenos</p>
          <p className="mt-1 text-xs text-[#6b645c]">
            ¡Bienvenido! Nuestro equipo de soporte está listo para ayudarte.
          </p>
        </button>

        <div className="px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#6b645c]">
              Preguntas frecuentes
            </p>
            <button
              type="button"
              onClick={onOpenFaqCategories}
              className="text-xs font-medium text-[var(--brand-primary-deep)] hover:underline"
            >
              Ver todas
            </button>
          </div>
          <input
            type="search"
            placeholder="Buscar preguntas frecuentes..."
            aria-label="Buscar en FAQs"
            className="mb-3 h-9 w-full rounded-lg border border-[var(--border-subtle)] px-3 text-sm text-[#141210] placeholder:text-[#9a9187] focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20"
          />
          <ul className="space-y-1">
            {categories.map((category) => (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm text-[#3f3a34] transition-colors hover:bg-[var(--surface-soft)]"
                >
                  <span>{category.title}</span>
                  <svg
                    className="h-4 w-4 shrink-0 text-[#9a9187]"
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

      <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-2 text-center">
        <p className="text-[10px] text-[#9a9187]">{poweredByLabel}</p>
      </div>
    </div>
  );
}
