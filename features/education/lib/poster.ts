import "server-only";

import { serverEnv } from "@/lib/env/env.server";

export const EDUCATION_POSTER_BUCKET = "education-posters";
export const EDUCATION_VIDEO_BUCKET = "education-videos";

export function educationPosterUrl(path: string | null | undefined): string | null {
  return publicObjectUrl(EDUCATION_POSTER_BUCKET, path);
}

export function educationVideoUrl(path: string | null | undefined): string | null {
  return publicObjectUrl(EDUCATION_VIDEO_BUCKET, path);
}

function publicObjectUrl(bucket: string, path: string | null | undefined): string | null {
  const clean = path?.trim();
  if (!clean) return null;
  const base = serverEnv.supabaseUrl.replace(/\/$/, "");
  if (!base) return null;
  const encoded = clean.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}
