"use client";

import { useState } from "react";

export function CopyTextButton({
  value,
  label = "Copiar",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-[11px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
