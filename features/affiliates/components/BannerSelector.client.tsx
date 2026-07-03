"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";
import type { BannerSize } from "@/types/affiliate";

interface BannerSelectorProps {
  sizes: BannerSize[];
}

export function BannerSelector({ sizes }: BannerSelectorProps) {
  const [selected, setSelected] = useState(sizes[0]?.id ?? "");

  const current = sizes.find((s) => s.id === selected) ?? sizes[0];

  const scale = current ? Math.min(1, 280 / Math.max(current.width, current.height)) : 1;
  const previewWidth = current ? current.width * scale : 300;
  const previewHeight = current ? current.height * scale : 250;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => (
          <button
            key={size.id}
            type="button"
            onClick={() => setSelected(size.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              selected === size.id
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {size.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
        <p className="mb-4 text-xs font-medium text-slate-500">Vista previa del banner</p>
        <div className="flex justify-center">
          <div
            style={{ width: previewWidth, height: previewHeight }}
            className="flex flex-col items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 p-3 text-center text-white shadow-md"
          >
            <p className="text-xs font-bold sm:text-sm">{siteConfig.name}</p>
            <p className="mt-1 text-[10px] opacity-90 sm:text-xs">
              Publicidad que escala
            </p>
            {current && (
              <p className="mt-2 text-[9px] opacity-70">{current.label}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
