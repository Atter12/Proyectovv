import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { educationLessons } from "./catalog";
import { loomEmbedUrl } from "./loom";
import type { EducationLessonView } from "./types";

export type { EducationLessonView };

type LessonRow = {
  slug: string;
  loom_url: string | null;
  updated_at: string | null;
};

export async function listEducationLessons(): Promise<EducationLessonView[]> {
  const stored = await loadLessonRows();
  return educationLessons.map((lesson) => {
    const row = stored.get(lesson.slug);
    const loomUrl = row?.loom_url?.trim() || null;
    return {
      ...lesson,
      loomUrl,
      embedUrl: loomEmbedUrl(loomUrl),
      updatedAt: row?.updated_at ?? null,
    };
  });
}

async function loadLessonRows(): Promise<Map<string, LessonRow>> {
  const map = new Map<string, LessonRow>();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("education_lessons")
      .select("slug, loom_url, updated_at");
    if (error || !data) return map;
    for (const row of data as LessonRow[]) {
      map.set(row.slug, row);
    }
  } catch {
    return map;
  }
  return map;
}
