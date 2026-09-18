"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function CreativeMediaTile({
  previewUrl,
  posterUrl,
  mediaKind,
  label,
  playLabel,
  size = "card",
}: {
  previewUrl: string | null;
  posterUrl: string | null;
  mediaKind: "video" | "image" | null;
  label: string;
  playLabel: string;
  size?: "card" | "row";
}) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const still = posterUrl || (mediaKind === "image" ? previewUrl : null);
  const canPlay = mediaKind === "video" && Boolean(previewUrl) && !failed;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl bg-[rgb(20_18_16_/_0.06)]",
        size === "card" ? "h-[7.25rem] w-[4.6rem]" : "h-14 w-14 rounded-lg",
      )}
    >
      {playing && canPlay && previewUrl ? (
        <video
          src={previewUrl}
          poster={posterUrl ?? undefined}
          className="h-full w-full object-cover"
          controls
          autoPlay
          muted
          playsInline
          onError={() => {
            setPlaying(false);
            setFailed(true);
          }}
        />
      ) : still && !failed ? (
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
            onError={() => setFailed(true)}
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
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
          {mediaKind === "video" ? "Video" : "—"}
        </div>
      )}
    </div>
  );
}
