"use client";

import { useState } from "react";
import { BannerSizeSelector } from "./BannerSizeSelector.client";
import { BannerPreviewPanel } from "./BannerPreviewPanel";
import type { BannerSize } from "@/types/affiliate";

interface AffiliateBannerStudioProps {
  sizes: BannerSize[];
  defaultSize: string;
  referralUrl: string;
}

export function AffiliateBannerStudio({
  sizes,
  defaultSize,
  referralUrl,
}: AffiliateBannerStudioProps) {
  const [selected, setSelected] = useState(defaultSize);
  const current = sizes.find((s) => s.id === selected) ?? sizes[0];

  if (!current) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-[#0f172a]">
          Tamaños de banner
        </h3>
        <BannerSizeSelector
          sizes={sizes}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      <BannerPreviewPanel size={current} referralUrl={referralUrl} />
    </div>
  );
}
