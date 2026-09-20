"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import {
  isLikelyImageUrl,
  isLikelyVideoUrl,
} from "@/lib/creatives/tiktok-media-preview";

function toHttps(url: string | null | undefined): string | null {
  const text = String(url ?? "").trim();
  if (!text) return null;
  if (text.startsWith("http://")) return `https://${text.slice(7)}`;
  return text;
}

export function CreativeMediaTile({
  previewUrl,
  posterUrl,
  mediaKind,
  label,
  playLabel,
  emptyLabel,
  closeLabel = "Cerrar",
  size = "card",
}: {
  previewUrl: string | null;
  posterUrl: string | null;
  mediaKind: "video" | "image" | null;
  label: string;
  playLabel: string;
  emptyLabel?: string;
  closeLabel?: string;
  size?: "card" | "row" | "poster";
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoomOpen]);

  const rawPreview = toHttps(previewUrl);
  const rawPoster = toHttps(posterUrl);

  const playable =
    rawPreview &&
    !videoFailed &&
    !isLikelyImageUrl(rawPreview) &&
    (mediaKind === "video" || isLikelyVideoUrl(rawPreview) || mediaKind == null)
      ? rawPreview
      : null;

  const still =
    (!imageFailed && rawPoster) ||
    (!imageFailed && mediaKind === "image" ? rawPreview : null) ||
    (!imageFailed && rawPreview && isLikelyImageUrl(rawPreview)
      ? rawPreview
      : null) ||
    null;

  const canPlay = Boolean(playable);
  const canOpen = Boolean(still || playable);

  return (
    <>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-[rgb(20_18_16_/_0.06)]",
          size === "poster"
            ? "h-44 w-28"
            : size === "card"
              ? "h-[7.25rem] w-[4.6rem]"
              : "h-14 w-14 rounded-lg",
        )}
      >
        {still || playable ? (
          <button
            type="button"
            className="group relative h-full w-full"
            aria-label={canPlay ? playLabel : label}
            onClick={() => {
              if (canOpen) setZoomOpen(true);
            }}
          >
            {still ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={still}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-black/10 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                Video
              </span>
            )}
            {canPlay ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/35">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[11px] font-bold text-[var(--auth-text)] shadow-sm">
                  ▶
                </span>
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
              {mediaKind === "video" || size === "poster" ? "Video" : "—"}
            </span>
            {emptyLabel ? (
              <span className="text-[9px] leading-3 text-[var(--auth-text-muted)]">
                {emptyLabel}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {mounted &&
        zoomOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onClick={() => setZoomOpen(false)}
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-black shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[12px] font-bold text-[var(--auth-text)]"
                onClick={() => setZoomOpen(false)}
              >
                {closeLabel}
              </button>
              {playable ? (
                <video
                  key={playable}
                  src={playable}
                  poster={still ?? undefined}
                  className="max-h-[80vh] w-full bg-black object-contain"
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  onError={() => setVideoFailed(true)}
                />
              ) : still ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={still}
                  alt={label}
                  className="max-h-[80vh] w-full object-contain"
                />
              ) : null}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
