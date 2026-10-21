import { getTranslations } from "next-intl/server";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { CreativeMediaTile } from "@/features/creative-analyzer/components/CreativeMediaTile";
import { loadClienteVideoGallery, VIDEO_GALLERY_DAYS } from "@/lib/radar/video-gallery.server";
import type { VideoVerdict } from "@/lib/radar/video-gallery";
import { cn } from "@/lib/cn";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const VERDICT_TONE: Record<VideoVerdict, string> = {
  winner: "bg-[#ecf7f0] text-[#1f5c40]",
  noResults: "bg-[#fef2f2] text-[#991b1b]",
  tired: "bg-amber-50 text-amber-900",
  expensive: "bg-[rgb(255_120_31_/_0.12)] text-[var(--auth-accent)]",
  steady: "bg-[rgb(20_18_16_/_0.05)] text-[var(--auth-text-muted)]",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--auth-text-soft)]">
        {label}
      </p>
      <p className="truncate text-[13px] font-semibold tabular-nums text-[var(--auth-text)]">
        {value}
      </p>
    </div>
  );
}

/** Videos del cliente que están corriendo en TikTok, con gasto y resultado. */
export async function TikTokVideoGallery({
  clienteId,
  organizationId,
}: {
  clienteId: string;
  organizationId?: string;
}) {
  const t = await getTranslations("creatives.videoGallery");

  let data: Awaited<ReturnType<typeof loadClienteVideoGallery>> | null = null;
  try {
    data = await loadClienteVideoGallery({ hecomClienteId: clienteId, organizationId });
  } catch (error) {
    console.warn("[creative-analyzer] video_gallery", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }

  const subtitle = data
    ? t("subtitle", {
        days: VIDEO_GALLERY_DAYS,
        videos: data.totals.videos,
        spend: usd.format(data.totals.spend),
        cpr: data.totals.costPerResult != null ? usd.format(data.totals.costPerResult) : "—",
      })
    : t("subtitleEmpty", { days: VIDEO_GALLERY_DAYS });

  return (
    <CrmPanel title={t("title")} subtitle={subtitle}>
      {!data || data.videos.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-[14px] font-semibold text-[var(--auth-text)]">
            {data ? t("emptyTitle") : t("errorTitle")}
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--auth-text-muted)]">
            {data ? t("emptyBody") : t("errorBody")}
          </p>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
            {data.videos.map((video) => {
              const preview = data.previews[video.videoId ?? video.key];
              return (
                <li
                  key={video.key}
                  className="flex gap-3 rounded-[1.1rem] border border-[rgb(20_18_16_/_0.08)] bg-white p-3 shadow-[0_8px_20px_rgb(20_18_16_/_0.03)]"
                >
                  <CreativeMediaTile
                    previewUrl={preview?.previewUrl ?? null}
                    posterUrl={preview?.posterUrl ?? null}
                    mediaKind={video.videoId || preview?.previewUrl ? "video" : preview?.posterUrl ? "image" : null}
                    label={video.name}
                    playLabel={t("play")}
                    closeLabel={t("close")}
                    size="card"
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
                        VERDICT_TONE[video.verdict],
                      )}
                    >
                      {t(`verdict.${video.verdict}`)}
                    </span>
                    <p
                      className="mt-1.5 truncate text-[13px] font-semibold tracking-[-0.01em] text-[var(--auth-text)]"
                      title={video.name}
                    >
                      {video.name}
                    </p>
                    <p className="text-[11px] text-[var(--auth-text-muted)]">
                      {t("adsCount", { count: video.adsCount })}
                      {preview?.postUrl ? (
                        <>
                          {" · "}
                          <a
                            href={preview.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[var(--auth-text)] underline-offset-2 hover:underline"
                          >
                            {t("openPost")}
                          </a>
                        </>
                      ) : null}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <Stat label={t("spend")} value={usd.format(video.spend)} />
                      <Stat label={t("results")} value={int.format(video.results)} />
                      <Stat
                        label={t("cpr")}
                        value={video.costPerResult != null ? usd.format(video.costPerResult) : "—"}
                      />
                      <Stat
                        label={t("hold6s")}
                        value={video.hold6s != null ? `${Math.round(video.hold6s * 100)}%` : "—"}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="px-4 pb-4 text-[11px] text-[var(--auth-text-muted)] sm:px-5">
            {t("footnote", { through: data.dataThrough ?? data.to })}
          </p>
        </>
      )}
    </CrmPanel>
  );
}
