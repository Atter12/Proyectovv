"use client";

import { useState } from "react";
import { siteConfig } from "@/config/site";
import type { BannerSize } from "@/types/affiliate";

interface BannerPreviewPanelProps {
  size: BannerSize;
  referralUrl: string;
}

function BannerVisual({ size }: { size: BannerSize }) {
  const scale = Math.min(1, 320 / Math.max(size.width, size.height));
  const w = size.width * scale;
  const h = size.height * scale;
  const isWide = size.width / size.height > 3;
  const isTall = size.height / size.width > 1.5;

  return (
    <div
      style={{ width: w, height: h }}
      className="relative overflow-hidden rounded-lg bg-gradient-to-br from-[var(--brand-primary-deep)] via-[var(--brand-primary)] to-[#06b6d4] shadow-lg"
    >
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/15 blur-md" />
      <div className="absolute -bottom-3 -left-3 h-12 w-12 rounded-full bg-amber-300/25 blur-sm" />
      <div className="absolute right-2 top-2 h-5 w-5 rounded-full border border-white/20 bg-white/10" />

      <div
        className={`relative z-10 flex h-full flex-col justify-center p-3 ${
          isWide ? "flex-row items-center gap-3 px-4" : ""
        }`}
      >
        <div className={isWide ? "flex-1" : ""}>
          <p
            className={`font-bold text-white ${
              isTall ? "text-sm" : "text-[10px] sm:text-xs"
            }`}
          >
            {siteConfig.name}
          </p>
          <p
            className={`mt-0.5 text-white/85 ${
              isTall ? "text-xs" : "text-[8px] sm:text-[10px]"
            } ${isWide ? "max-w-[200px]" : ""}`}
          >
            Invita anunciantes y gana
          </p>
        </div>
        {!isTall && (
          <span
            className={`mt-1.5 inline-flex items-center rounded-md bg-white/20 px-2 py-0.5 font-semibold text-white backdrop-blur-sm ${
              isWide ? "mt-0 shrink-0 text-[9px]" : "text-[8px]"
            }`}
          >
            Empieza ahora
          </span>
        )}
        {isTall && (
          <span className="mt-3 inline-flex w-fit items-center rounded-md bg-white/20 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
            Empieza ahora
          </span>
        )}
      </div>
    </div>
  );
}

export function BannerPreviewPanel({ size, referralUrl }: BannerPreviewPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopyCode() {
    const snippet = `<!-- Default Media Banner ${size.label} -->\n<a href="${referralUrl}"><img src="#" alt="${siteConfig.name}" width="${size.width}" height="${size.height}" /></a>`;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e7eb] px-5 py-4">
        <h3 className="text-sm font-semibold text-[#0f172a]">
          Vista previa del banner
        </h3>
        <span className="rounded-full bg-[var(--brand-primary)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--brand-primary)]">
          {size.label}
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,240px)]">
        <div
          className="flex min-h-[180px] items-center justify-center overflow-x-auto p-4 sm:min-h-[200px] sm:p-6"
          style={{
            backgroundImage:
              "linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            backgroundColor: "#f8fafc",
          }}
        >
          <div className="max-w-full rounded-xl border-2 border-dashed border-[#dbe1ea] p-3 sm:p-4">
            <BannerVisual size={size} />
          </div>
        </div>

        <div className="border-t border-[#e5e7eb] bg-slate-50/50 p-5 lg:border-l lg:border-t-0">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                Tamaño
              </dt>
              <dd className="mt-0.5 font-semibold text-[#0f172a]">{size.label}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                Formato
              </dt>
              <dd className="mt-0.5 text-[#0f172a]">Banner de ejemplo — {size.formatName}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                Estado
              </dt>
              <dd className="mt-0.5 text-[#16a34a] font-medium">Listo para copiar</dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                Uso recomendado
              </dt>
              <dd className="mt-0.5 text-[#64748b]">Sitios web y blogs</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleCopyCode}
            aria-label="Copiar código del banner"
            className={`mt-5 h-11 w-full rounded-xl px-4 text-sm font-semibold transition-all duration-200 ${
              copied
                ? "bg-[#16a34a] text-white"
                : "border border-[#dbe1ea] bg-white text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/5"
            }`}
          >
            {copied ? "¡Copiado!" : "Copiar código del banner"}
          </button>
        </div>
      </div>
    </div>
  );
}
