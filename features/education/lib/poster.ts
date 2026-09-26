import "server-only";

import { serverEnv } from "@/lib/env/env.server";

export const EDUCATION_POSTER_BUCKET = "education-posters";

export function educationPosterUrl(path: string | null | undefined): string | null {
  const clean = path?.trim();
  if (!clean) return null;
  const base = serverEnv.supabaseUrl.replace(/\/$/, "");
  if (!base) return null;
  const encoded = clean.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `${base}/storage/v1/object/public/${EDUCATION_POSTER_BUCKET}/${encoded}`;
}
