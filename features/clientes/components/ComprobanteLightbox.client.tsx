"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface ComprobanteLightboxProps {
  open: boolean;
  url: string;
  title: string;
  kind: "image" | "pdf" | "unknown";
  onClose: () => void;
}

export function ComprobanteLightbox({
  open,
  url,
  title,
  kind,
  onClose,
}: ComprobanteLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/80 backdrop-blur-sm"
        aria-label="Cerrar vista ampliada"
        onClick={onClose}
      />
      <div className="relative flex max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c1917] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <p className="truncate text-sm font-semibold text-white">{title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Abrir archivo
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#0f0e0d] p-4">
          {kind === "pdf" ? (
            <iframe
              src={url}
              title={title}
              className="h-[min(75vh,720px)] w-full rounded-lg bg-white"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={title}
              className="max-h-[min(75vh,720px)] max-w-full rounded-lg object-contain shadow-lg"
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
