"use client";

import { useState } from "react";
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
  closeLabel: _closeLabel,
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
  const [playing, setPlaying] = useState(false);

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
  // Nunca auto-montar <video>: las URLs firmadas de TikTok suelen expirar
  // y un onError borraba también la portada.
  const showVideo = playing && canPlay;

  return (
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
      {showVideo && playable ? (
        <video
          src={playable}
          poster={still ?? undefined}
          className="h-full w-full object-cover"
          controls
          autoPlay
          muted
          playsInline
          preload="metadata"
          onError={() => {
            setVideoFailed(true);
            setPlaying(false);
          }}
        />
      ) : still ? (
        <button
          type="button"
          className="group relative h-full w-full"
          aria-label={canPlay ? playLabel : label}
          onClick={() => {
            if (canPlay) setPlaying(true);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={still}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
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
  );
}
