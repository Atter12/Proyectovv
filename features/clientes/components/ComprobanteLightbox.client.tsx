"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ComprobanteLightboxProps {
  open: boolean;
  url: string;
  title: string;
  kind: "image" | "pdf" | "unknown";
  onClose: () => void;
}

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

export function ComprobanteLightbox({
  open,
  url,
  title,
  kind,
  onClose,
}: ComprobanteLightboxProps) {
  const [zoom, setZoom] = useState(1);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100));
  }, []);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100));
  }, []);

  const zoomReset = useCallback(() => setZoom(1), []);

  useEffect(() => {
    if (!open) {
      setZoom(1);
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        zoomIn();
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        zoomOut();
      }
      if (event.key === "0") {
        event.preventDefault();
        zoomReset();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, zoomIn, zoomOut, zoomReset]);

  if (!open || typeof document === "undefined") return null;

  const isImage = kind === "image" || kind === "unknown";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Vista ampliada: ${title}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/82 backdrop-blur-[6px]"
        aria-label="Cerrar vista ampliada"
        onClick={onClose}
      />

      <div className="relative flex max-h-[min(94vh,calc(100dvh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#161412] shadow-[0_24px_80px_-24px_rgb(0_0_0_/_0.65)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5 sm:py-3">
          <p className="min-w-0 truncate text-[13px] font-semibold text-white sm:text-sm">
            {title}
          </p>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {isImage ? (
              <div className="mr-1 flex items-center gap-0.5 rounded-lg bg-white/8 p-0.5 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= ZOOM_MIN}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/85 transition hover:bg-white/10 disabled:opacity-35"
                  aria-label="Alejar"
                  title="Alejar (−)"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M5 12h14" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={zoomReset}
                  className="min-w-[3rem] px-1 text-center text-[11px] font-semibold tabular-nums text-white/75 transition hover:text-white"
                  title="Restablecer zoom (0)"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= ZOOM_MAX}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-white/85 transition hover:bg-white/10 disabled:opacity-35"
                  aria-label="Acercar"
                  title="Acercar (+)"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
            ) : null}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white/70 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Abrir archivo
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Cerrar"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#0c0b0a] p-3 sm:p-5">
          {kind === "pdf" ? (
            <iframe
              src={url}
              title={title}
              className="h-[min(78vh,760px)] w-full rounded-xl bg-white"
            />
          ) : (
            <div className="flex min-h-full w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={title}
                onDoubleClick={() =>
                  setZoom((z) => (z >= 1.5 ? 1 : Math.min(ZOOM_MAX, z + 0.5)))
                }
                style={{ transform: `scale(${zoom})` }}
                className="max-h-[min(78vh,760px)] max-w-full origin-center rounded-xl object-contain shadow-[0_16px_48px_-12px_rgb(0_0_0_/_0.55)] transition-transform duration-200 ease-out"
              />
            </div>
          )}
        </div>

        {isImage ? (
          <p className="border-t border-white/8 px-4 py-2 text-center text-[10px] text-white/40 sm:text-[11px]">
            Clic fuera o Esc para cerrar · + / − para zoom · doble clic acerca
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
