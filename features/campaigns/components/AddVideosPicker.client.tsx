"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { LaunchOptions } from "@/lib/campaigns/launch-options.server";

/** Pocos a la vez: Smart+ necesita días para aprender con cada video nuevo. */
const MAX_PICK = 5;

/**
 * Elige videos de la biblioteca de la cuenta para sumarlos a una campaña
 * lanzada. `onSubmit` hace el pedido (sumar directo o aprobar una sugerencia).
 */
export function AddVideosPicker({
  launchId,
  onSubmit,
  onCancel,
}: {
  launchId: string;
  onSubmit: (videoIds: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("creatives.launched.addVideos");
  const [videos, setVideos] = useState<LaunchOptions["videos"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/campaigns/videos?launchId=${encodeURIComponent(launchId)}`)
      .then(async (response) => {
        const data = (await response.json()) as { videos?: LaunchOptions["videos"]; message?: string; error?: string };
        if (!response.ok) throw new Error(data.message ?? data.error);
        if (!cancelled) setVideos(data.videos ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(t("loadError"));
      });
    return () => {
      cancelled = true;
    };
  }, [launchId, t]);

  function toggle(id: string) {
    setPicked((list) => (list.includes(id) ? list.filter((v) => v !== id) : list.length >= MAX_PICK ? list : [...list, id]));
  }

  async function submit() {
    setSaving(true);
    try {
      await onSubmit(picked);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[rgb(20_18_16_/_0.1)] bg-white p-3">
      <p className="text-[12px] font-semibold text-[var(--auth-text)]">{t("title", { count: picked.length, max: MAX_PICK })}</p>
      {error ? (
        <p className="mt-2 rounded-lg bg-[#fef2f2] px-2.5 py-1.5 text-[12px] text-[#991b1b]">{error}</p>
      ) : videos === null ? (
        <p className="mt-2 text-[12px] text-[var(--auth-text-muted)]">{t("loading")}</p>
      ) : videos.length === 0 ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-950">{t("empty")}</p>
      ) : (
        <div className="mt-2 flex max-h-[15rem] flex-wrap gap-2 overflow-y-auto">
          {videos.map((video) => {
            const on = picked.includes(video.videoId);
            return (
              <button
                key={video.videoId}
                type="button"
                disabled={saving}
                onClick={() => toggle(video.videoId)}
                title={video.name}
                className={cn(
                  "relative h-28 w-[4.1rem] overflow-hidden rounded-lg bg-black/80 ring-2 transition",
                  on ? "ring-[var(--auth-accent)]" : "ring-transparent opacity-70 hover:opacity-100",
                )}
              >
                {video.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
                {on ? (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[var(--auth-accent)] text-[11px] font-bold text-white">
                    ✓
                  </span>
                ) : null}
                {video.durationSec ? (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] font-semibold text-white">
                    {video.durationSec}s
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-1.5 text-[11px] text-[var(--auth-text-muted)]">{t("hint")}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || picked.length === 0}
          onClick={() => void submit()}
          className="h-9 rounded-xl bg-[var(--auth-accent)] px-3.5 text-[12px] font-bold text-white disabled:opacity-50"
        >
          {saving ? t("saving") : t("submit", { count: picked.length })}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="h-9 rounded-xl border border-[rgb(20_18_16_/_0.12)] px-3.5 text-[12px] font-semibold text-[var(--auth-text)]"
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
