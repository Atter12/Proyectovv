"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

const noopSubscribe = () => () => {};
import { useTranslations } from "next-intl";
import type { EducationLessonView } from "../lib/types";

export function EducationPlayerDialog({
  lesson,
  canManage,
  onClose,
}: {
  lesson: EducationLessonView | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("education");
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // iPhone Safari no permite fullscreen en un <div>: el botón no haría nada.
  const canFullscreen = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(document.fullscreenEnabled),
    () => false,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lesson && !dialog.open) dialog.showModal();
    if (!lesson && dialog.open) dialog.close();
  }, [lesson]);

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === playerRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  async function toggleFullscreen() {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (document.fullscreenElement === player) {
        await document.exitFullscreen();
        return;
      }
      await player.requestFullscreen();
    } catch {
      // El navegador rechazó el cambio; el reproductor sigue igual.
    }
  }

  const ready = Boolean(lesson?.videoUrl || lesson?.embedUrl);
  // Loom y Drive no aceptan portada propia: se muestra encima hasta que le dan play.
  const [startedSlug, setStartedSlug] = useState<string | null>(null);
  const showCover =
    Boolean(lesson?.videoPosterUrl) && !lesson?.videoUrl && startedSlug !== lesson?.slug;
  // El MP4 puede ser vertical o cuadrado; Loom y Drive no dicen su proporción y quedan en 16:9.
  const [measured, setMeasured] = useState<{ src: string; ratio: number } | null>(null);
  const ratio =
    lesson?.videoUrl && measured?.src === lesson.videoUrl ? measured.ratio : 16 / 9;

  return (
    <dialog
      ref={dialogRef}
      className="education-dialog"
      style={{ "--education-ratio": String(ratio) } as CSSProperties}
      aria-labelledby={titleId}
      onClose={() => {
        setStartedSlug(null);
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {lesson ? (
        <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_24px_80px_-24px_rgb(28_25_23_/_0.45)]">
          <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-accent)]">
                {t("lessonNumber", { number: lesson.number })}
              </p>
              <h2 id={titleId} className="truncate text-[1.05rem] font-bold text-[var(--auth-text)]">
                {lesson.title}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {ready && !lesson.videoUrl && canFullscreen ? (
                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  className="inline-flex h-10 items-center rounded-xl bg-[var(--auth-accent)] px-3 text-[13px] font-semibold text-white"
                >
                  {fullscreen ? t("exitFullscreen") : t("fullscreen")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center rounded-xl px-3 text-[13px] font-semibold text-[var(--auth-text-muted)] hover:bg-[var(--auth-bg)]"
              >
                {t("close")}
              </button>
            </div>
          </div>

          {ready ? (
            <div ref={playerRef} className="education-player flex flex-col bg-black">
              <div className="education-player-frame relative bg-black">
                {lesson.videoUrl ? (
                  <video
                    key={lesson.videoUrl}
                    src={lesson.videoUrl}
                    poster={lesson.videoPosterUrl ?? lesson.posterUrl ?? undefined}
                    controls
                    playsInline
                    onLoadedMetadata={(event) => {
                      const { videoWidth, videoHeight, currentSrc } = event.currentTarget;
                      if (!videoWidth || !videoHeight) return;
                      setMeasured({ src: lesson.videoUrl ?? currentSrc, ratio: videoWidth / videoHeight });
                    }}
                    className="h-full w-full"
                  />
                ) : showCover ? (
                  <button
                    type="button"
                    onClick={() => setStartedSlug(lesson.slug)}
                    aria-label={t("openLesson", { title: lesson.title })}
                    className="group relative block h-full w-full"
                  >
                    <img
                      src={lesson.videoPosterUrl ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 grid place-items-center bg-black/15">
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[var(--auth-text)] shadow-[0_10px_24px_-12px_rgb(0_0_0_/_0.6)] transition-transform group-hover:scale-105">
                        <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor" aria-hidden>
                          <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
                        </svg>
                      </span>
                    </span>
                  </button>
                ) : (
                  <iframe
                    key={lesson.slug}
                    src={
                      lesson.videoPosterUrl
                        ? withAutoplay(lesson.embedUrl)
                        : lesson.embedUrl ?? undefined
                    }
                    title={lesson.title}
                    className="h-full w-full"
                    allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="mx-4 mb-4 rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-bg)] px-5 py-8 text-center sm:mx-5">
              <p className="text-[1.15rem] font-bold text-[var(--auth-text)]">
                {t("unavailableTitle")}
              </p>
              <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[var(--auth-text-muted)]">
                {t("unavailableBody")}
              </p>
              {canManage ? (
                <p className="mx-auto mt-3 max-w-md text-[13px] font-medium text-[var(--auth-accent)]">
                  {t("unavailableManage")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </dialog>
  );
}

/** Tras pulsar la portada, Loom arranca solo; Drive ignora el parámetro. */
function withAutoplay(url: string | null): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith("https://www.loom.com/embed/")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
}
