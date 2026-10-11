"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RoundVideo } from "@/lib/radar/round-builder.server";
import { TikTokEmbed } from "./TikTokEmbed.client";

export type CardReaction = "like" | "dislike" | null;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff781f]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5 translate-x-[1px]" fill="currentColor">
      <path d="M8 5.6v12.8a.9.9 0 0 0 1.37.77l10.2-6.4a.9.9 0 0 0 0-1.54L9.37 4.83A.9.9 0 0 0 8 5.6Z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}

/**
 * Un video de la ronda. Muestra la miniatura (oEmbed) y carga el reproductor
 * oficial solo al tocarla. En la ronda 1 se reacciona con "me gusta" o "no es
 * para mí"; en la ronda 2 se elige como referencia.
 */
export function RadarVideoCard({
  video,
  mode,
  reaction,
  picked,
  onReact,
  onTogglePick,
  onDead,
}: {
  video: RoundVideo;
  mode: "react" | "pick";
  reaction?: CardReaction;
  picked?: boolean;
  onReact?: (reaction: Exclude<CardReaction, null>) => void;
  onTogglePick?: () => void;
  onDead: () => void;
}) {
  const t = useTranslations("profit.radar.card");
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const author = video.authorName ?? (video.authorHandle ? `@${video.authorHandle}` : t("unknownAuthor"));
  const dimmed = mode === "react" && reaction === "dislike";

  return (
    <article className="flex min-w-0 flex-col gap-2.5">
      <div
        className={`relative aspect-[9/16] overflow-hidden rounded-[14px] bg-[#1c1917] transition-[opacity,filter] duration-300 ${
          dimmed ? "opacity-45 grayscale" : ""
        } ${mode === "pick" && picked ? "ring-2 ring-[#17150f] ring-offset-2 ring-offset-white" : ""}`}
      >
        {playing ? (
          <TikTokEmbed videoId={video.videoId} title={t("play", { author })} onDead={onDead} />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className={`group absolute inset-0 block h-full w-full text-left ${focusRing}`}
            aria-label={t("play", { author })}
          >
            {video.thumbnailUrl && !thumbFailed ? (
              // Miniatura de TikTok tal cual (CSP img-src ya permite *.tiktokcdn.com).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={video.thumbnailUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setThumbFailed(true)}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
              />
            ) : null}
            <span className="absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(180deg,rgb(28_25_23/0)_0%,rgb(28_25_23/0.82)_100%)]" />
            <span className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#17150f] shadow-[0_6px_18px_-6px_rgb(0_0_0/0.5)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105">
              <PlayIcon />
            </span>
            <span className="absolute inset-x-3 bottom-3 flex flex-col gap-1 text-white">
              <span className="truncate text-[13px] font-semibold">{author}</span>
              {video.caption ? (
                <span className="line-clamp-2 text-[12px] leading-[1.4] text-white/85">{video.caption}</span>
              ) : null}
            </span>
          </button>
        )}
      </div>

      {mode === "react" ? (
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label={author}>
          <button
            type="button"
            aria-pressed={reaction === "like"}
            onClick={() => onReact?.("like")}
            className={`h-9 rounded-[10px] border text-[13px] font-semibold transition-colors ${focusRing} ${
              reaction === "like"
                ? "border-[#17150f] bg-[#17150f] text-white"
                : "border-[#e0d9d0] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
            }`}
          >
            {t("like")}
          </button>
          <button
            type="button"
            aria-pressed={reaction === "dislike"}
            onClick={() => onReact?.("dislike")}
            className={`h-9 rounded-[10px] border text-[13px] font-semibold transition-colors ${focusRing} ${
              reaction === "dislike"
                ? "border-[#e0d9d0] bg-[#f5f2ed] text-[#5c564e]"
                : "border-[#e0d9d0] bg-white text-[#5c564e] hover:border-[#cfc6bb]"
            }`}
          >
            {t("dislike")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-pressed={Boolean(picked)}
          onClick={onTogglePick}
          className={`flex h-9 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] font-semibold transition-colors ${focusRing} ${
            picked
              ? "border-[#17150f] bg-[#17150f] text-white"
              : "border-[#e0d9d0] bg-white text-[#1c1917] hover:border-[#cfc6bb]"
          }`}
        >
          {picked ? <CheckIcon /> : null}
          {picked ? t("picked") : t("pick")}
        </button>
      )}

      <a
        href={video.shareUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 self-start rounded text-[12px] font-medium text-[#8a8177] underline-offset-[3px] transition-colors hover:text-[#1c1917] hover:underline ${focusRing}`}
      >
        {t("openTikTok")}
        <ExternalIcon />
      </a>
    </article>
  );
}
