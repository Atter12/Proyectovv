"use client";

import { useState } from "react";

export function CopyLinkButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          // El navegador no dejó copiar: el link igual se ve en pantalla.
        }
      }}
      className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#ff781f] px-4 text-[13px] font-bold text-[#1c1917] transition hover:bg-[#f56a0b]"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
