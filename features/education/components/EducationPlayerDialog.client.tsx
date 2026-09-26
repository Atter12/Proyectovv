"use client";

import { useEffect, useId, useRef, useState } from "react";
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
    if (document.fullscreenElement === player) {
      await document.exitFullscreen();
      return;
    }
    await player.requestFullscreen();
  }

  const ready = Boolean(lesson?.videoUrl || lesson?.embedUrl);

  return (
    <dialog
      ref={dialogRef}
      className="education-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
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
              <div className="education-player-frame relative aspect-video w-full bg-black">
                {lesson.videoUrl ? (
                  <video
                    key={lesson.videoUrl}
                    src={lesson.videoUrl}
                    poster={lesson.posterUrl ?? undefined}
                    controls
                    playsInline
                    className="h-full w-full"
                  />
                ) : (
                  <iframe
                    key={lesson.slug}
                    src={lesson.embedUrl ?? undefined}
                    title={lesson.title}
                    className="h-full w-full"
                    allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}
                {lesson.videoUrl ? null : (
                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    className="absolute bottom-3 right-3 inline-flex h-10 items-center rounded-xl bg-[var(--auth-accent)] px-3 text-[13px] font-semibold text-white shadow-lg"
                  >
                    {fullscreen ? t("exitFullscreen") : t("fullscreen")}
                  </button>
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
