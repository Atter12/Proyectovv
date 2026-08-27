"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { ComprobanteLightbox } from "./ComprobanteLightbox.client";

type ComprobanteKind = "image" | "pdf" | "unknown";

function guessKindFromUrl(url: string): ComprobanteKind {
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif|heic|bmp)$/.test(path)) return "image";
  return "unknown";
}

export function CobroComprobantePreview({
  cobroId,
  index = 0,
  label = "Comprobante",
}: {
  cobroId: string;
  index?: number;
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<ComprobanteKind>("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const loadUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<{
        url: string;
        kind?: ComprobanteKind;
      }>(
        `/api/hecom/cobros/${encodeURIComponent(cobroId)}/comprobante?index=${index}`,
      );
      if (!data.url) throw new Error("Comprobante no disponible.");
      setUrl(data.url);
      setKind(data.kind ?? guessKindFromUrl(data.url));
    } catch (err) {
      setUrl(null);
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo cargar.",
      );
    } finally {
      setLoading(false);
    }
  }, [cobroId, index]);

  useEffect(() => {
    void loadUrl();
  }, [loadUrl]);

  if (loading) {
    return (
      <div
        className="h-14 w-14 shrink-0 animate-pulse rounded-lg border border-[var(--auth-divider)] bg-[var(--auth-bg)]"
        title="Cargando comprobante…"
      />
    );
  }

  if (error || !url) {
    return (
      <button
        type="button"
        onClick={() => void loadUrl()}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-[9px] font-medium text-red-700"
        title={error ?? "Reintentar"}
      >
        Reintentar
      </button>
    );
  }

  const isPdf = kind === "pdf";

  return (
    <>
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--auth-divider)] bg-[var(--auth-bg)] shadow-sm transition hover:border-[var(--auth-accent)] hover:ring-2 hover:ring-[var(--auth-accent)]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--auth-accent)]"
        title={`Ampliar ${label}`}
      >
        {isPdf ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[#faf8f5] text-[var(--auth-text-muted)]">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="text-[8px] font-bold uppercase tracking-wide">
              PDF
            </span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
          <svg
            className="h-5 w-5 text-white opacity-0 drop-shadow transition group-hover:opacity-100"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6"
            />
          </svg>
        </span>
      </button>

      <ComprobanteLightbox
        open={lightboxOpen}
        url={url}
        title={label}
        kind={isPdf ? "pdf" : "image"}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
