"use client";

import { cn } from "@/lib/cn";
import type { BannerSize } from "@/types/affiliate";

interface BannerSizeSelectorProps {
  sizes: BannerSize[];
  selected: string;
  onSelect: (id: string) => void;
}

export function BannerSizeSelector({
  sizes,
  selected,
  onSelect,
}: BannerSizeSelectorProps) {
  return (
    <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {sizes.map((size) => {
        const isActive = selected === size.id;
        return (
          <button
            key={size.id}
            type="button"
            onClick={() => onSelect(size.id)}
            aria-label={`Seleccionar banner ${size.label}`}
            aria-pressed={isActive}
            className={cn(
              "flex min-h-[44px] min-w-[112px] shrink-0 flex-col rounded-xl border px-3 py-2.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4056ff]/40",
              isActive
                ? "border-[#4056ff] bg-[#4056ff]/5 shadow-sm ring-2 ring-[#4056ff]/20"
                : "border-[#e5e7eb] bg-white hover:-translate-y-0.5 hover:border-[#dbe1ea] hover:shadow-sm",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-[#0f172a]">{size.label}</span>
              {isActive && (
                <svg className="h-3.5 w-3.5 text-[#4056ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </div>
            <span className="mt-0.5 text-[10px] text-[#64748b]">{size.formatName}</span>
          </button>
        );
      })}
    </div>
  );
}
