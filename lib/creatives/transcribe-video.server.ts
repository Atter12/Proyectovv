import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";

/** Whisper API rejects files above 25 MB. Stay under that. */
const MAX_BYTES = 24 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const WHISPER_TIMEOUT_MS = 60_000;

export type VideoTranscript = {
  text: string;
  language: string | null;
  durationSec: number | null;
};

function extForMime(mimeType: string): string {
  const mime = mimeType.toLowerCase();
  if (mime.includes("webm")) return "webm";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4") || mime.includes("m4a")) return "mp4";
  return "mp4";
}

function isVideoLike(mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  return (
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/octet-stream"
  );
}

export async function transcribeVideoBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  filename?: string;
}): Promise<VideoTranscript | null> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) return null;
  if (input.buffer.length === 0 || input.buffer.length > MAX_BYTES) {
    console.warn("[transcribe-video] skip_size", input.buffer.length);
    return null;
  }
  if (!isVideoLike(input.mimeType) && !input.mimeType.startsWith("application/")) {
    return null;
  }

  const mime = input.mimeType.split(";")[0]?.trim() || "video/mp4";
  const filename =
    input.filename?.replace(/[^\w.\-]+/g, "_").slice(0, 80) ||
    `clip.${extForMime(mime)}`;
  const named = filename.includes(".") ? filename : `${filename}.${extForMime(mime)}`;

  const bytes = new Uint8Array(input.buffer.byteLength);
  bytes.set(input.buffer);
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), named);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  try {
    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(WHISPER_TIMEOUT_MS),
      },
    );
    const data = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
      error?: { message?: string };
    };
    if (!response.ok) {
      console.warn(
        "[transcribe-video] openai",
        data.error?.message ?? response.status,
      );
      return null;
    }
    const text = String(data.text ?? "").replace(/\s+/g, " ").trim();
    return {
      text,
      language: typeof data.language === "string" ? data.language : null,
      durationSec:
        typeof data.duration === "number" && Number.isFinite(data.duration)
          ? data.duration
          : null,
    };
  } catch (error) {
    console.warn(
      "[transcribe-video] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

async function downloadHttpVideo(
  url: string,
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn("[transcribe-video] preview_http", response.status);
      return null;
    }
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
    const mime =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      "video/mp4";
    if (mime.startsWith("image/")) return null;
    return { buffer, mimeType: mime };
  } catch (error) {
    console.warn(
      "[transcribe-video] preview_download",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

async function downloadStoredVideo(input: {
  bucket: string;
  path: string;
  mimeType: string | null;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(input.bucket)
    .download(input.path);
  if (error || !data) {
    console.warn("[transcribe-video] storage", error?.message);
    return null;
  }
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_BYTES) return null;
  const mime =
    input.mimeType ||
    (data as Blob & { type?: string }).type ||
    "video/mp4";
  if (mime.startsWith("image/")) return null;
  return { buffer, mimeType: mime };
}

function cachedTranscriptText(
  publish: Record<string, unknown>,
): string | undefined {
  if (typeof publish.transcript === "string" && publish.transcript_at) {
    return publish.transcript.replace(/\s+/g, " ").trim();
  }
  return undefined;
}

/**
 * Transcript cacheado en publish_result, o Whisper si todavía no hay.
 * `null` = no hay voz usable. No vuelve a llamar Whisper si ya hay cache.
 */
export async function ensureDraftTranscript(input: {
  draftId: string;
  previewUrl?: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();
  const { data: draft, error } = await admin
    .from("creative_publish_drafts")
    .select("publish_result, creative_asset_id")
    .eq("id", input.draftId)
    .maybeSingle<{
      publish_result: Record<string, unknown> | null;
      creative_asset_id: string | null;
    }>();
  if (error || !draft) return null;

  const publish =
    draft.publish_result && typeof draft.publish_result === "object"
      ? draft.publish_result
      : {};
  const cached = cachedTranscriptText(publish);
  if (cached !== undefined) {
    return cached.length >= 8 ? cached : null;
  }

  let media: { buffer: Buffer; mimeType: string } | null = null;
  if (draft.creative_asset_id) {
    const { data: asset } = await admin
      .from("creative_assets")
      .select("storage_bucket, storage_path, mime_type, name")
      .eq("id", draft.creative_asset_id)
      .maybeSingle<{
        storage_bucket: string | null;
        storage_path: string | null;
        mime_type: string | null;
        name: string | null;
      }>();
    if (asset?.storage_bucket && asset.storage_path) {
      media = await downloadStoredVideo({
        bucket: asset.storage_bucket,
        path: asset.storage_path,
        mimeType: asset.mime_type,
      });
    }
  }

  if (!media) {
    const fromPublish =
      typeof publish.preview_url === "string" ? publish.preview_url : "";
    const url = /^https?:\/\//i.test(fromPublish)
      ? fromPublish
      : String(input.previewUrl ?? "");
    media = await downloadHttpVideo(url);
  }

  if (!media) return null;

  const spoken = await transcribeVideoBuffer({
    buffer: media.buffer,
    mimeType: media.mimeType,
  });
  if (!spoken) return null;

  const text = spoken.text.replace(/\s+/g, " ").trim();
  const nextPublish: Record<string, unknown> = {
    ...publish,
    transcript: text,
    transcript_at: new Date().toISOString(),
    transcript_source: "whisper-1",
    ...(spoken?.language ? { transcript_language: spoken.language } : {}),
  };
  const { error: saveError } = await admin
    .from("creative_publish_drafts")
    .update({
      publish_result: nextPublish,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.draftId);
  if (saveError) {
    console.warn("[transcribe-video] cache", saveError.message);
  }

  return text.length >= 8 ? text : null;
}
