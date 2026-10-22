import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  educationLessons,
  isEducationCategoryId,
  type EducationCategoryId,
} from "./catalog";
import { lessonEmbedUrl } from "./loom";
import { educationPosterUrl, educationVideoUrl } from "./poster";
import type { EducationLessonView } from "./types";

export type { EducationLessonView };

type LessonRow = {
  slug: string;
  loom_url: string | null;
  title: string | null;
  category_id: string | null;
  poster_path: string | null;
  is_custom: boolean | null;
  recommended: boolean | null;
  video_path: string | null;
  video_poster_path: string | null;
  active: boolean | null;
  updated_at: string | null;
  created_at: string | null;
};

export async function listEducationLessons(): Promise<EducationLessonView[]> {
  const stored = await loadLessonRows();
  const catalog = educationLessons.map((lesson) => {
    const row = stored.get(lesson.slug);
    return toView(lesson, row, false);
  });

  const known = new Set(educationLessons.map((lesson) => lesson.slug));
  const custom = [...stored.values()]
    .filter((row) => row.is_custom && !known.has(row.slug) && row.title?.trim())
    .sort((left, right) => stamp(left) - stamp(right))
    .map((row, index) =>
      toView(
        {
          slug: row.slug,
          number: educationLessons.length + index + 1,
          categoryId: categoryOrDefault(row.category_id),
          title: row.title!.trim(),
          description: "",
          recommended: false,
        },
        row,
        true,
      ),
    );

  return [...catalog, ...custom];
}

function toView(
  lesson: {
    slug: string;
    number: number;
    categoryId: EducationCategoryId;
    title: string;
    description: string;
    recommended: boolean;
  },
  row: LessonRow | undefined,
  custom: boolean,
): EducationLessonView {
  const loomUrl = row?.loom_url?.trim() || null;
  const title = row?.title?.trim() || lesson.title;
  const recommended =
    typeof row?.recommended === "boolean" ? row.recommended : lesson.recommended;
  return {
    ...lesson,
    title,
    recommended,
    loomUrl,
    embedUrl: lessonEmbedUrl(loomUrl),
    posterUrl: educationPosterUrl(row?.poster_path),
    videoUrl: educationVideoUrl(row?.video_path),
    videoPosterUrl: educationPosterUrl(row?.video_poster_path),
    active: row?.active !== false,
    updatedAt: row?.updated_at ?? null,
    custom,
  };
}

function categoryOrDefault(value: string | null): EducationCategoryId {
  return value && isEducationCategoryId(value) ? value : "empieza";
}

function stamp(row: LessonRow): number {
  const value = Date.parse(row.created_at ?? row.updated_at ?? "");
  return Number.isFinite(value) ? value : 0;
}

// Con `*` una migración pendiente (p. ej. sin `active`) no oculta el video a todos:
// las columnas que falten simplemente no vienen y quedan en null.
async function loadLessonRows(): Promise<Map<string, LessonRow>> {
  const map = new Map<string, LessonRow>();
  try {
    const admin = createAdminClient();
    const result = await admin.from("education_lessons").select("*");
    if (result.error || !result.data) return map;
    for (const row of result.data as Partial<LessonRow>[]) {
      if (!row.slug) continue;
      map.set(row.slug, {
        slug: row.slug,
        loom_url: row.loom_url ?? null,
        title: row.title ?? null,
        category_id: row.category_id ?? null,
        poster_path: row.poster_path ?? null,
        is_custom: row.is_custom ?? false,
        recommended: row.recommended ?? null,
        video_path: row.video_path ?? null,
        video_poster_path: row.video_poster_path ?? null,
        active: row.active ?? null,
        updated_at: row.updated_at ?? null,
        created_at: row.created_at ?? null,
      });
    }
  } catch {
    return map;
  }
  return map;
}
