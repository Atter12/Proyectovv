import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  educationLessons,
  isEducationCategoryId,
  type EducationCategoryId,
} from "./catalog";
import { loomEmbedUrl } from "./loom";
import { educationPosterUrl } from "./poster";
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
    embedUrl: loomEmbedUrl(loomUrl),
    posterUrl: educationPosterUrl(row?.poster_path),
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

async function loadLessonRows(): Promise<Map<string, LessonRow>> {
  const map = new Map<string, LessonRow>();
  try {
    const admin = createAdminClient();
    const media =
      "slug, loom_url, title, category_id, poster_path, is_custom, updated_at, created_at";
    const withRecommended = await admin
      .from("education_lessons")
      .select(`${media}, recommended`);
    if (!withRecommended.error && withRecommended.data) {
      for (const row of withRecommended.data as LessonRow[]) map.set(row.slug, row);
      return map;
    }

    const full = await admin.from("education_lessons").select(media);
    if (!full.error && full.data) {
      for (const row of full.data as LessonRow[]) {
        map.set(row.slug, { ...row, recommended: null });
      }
      return map;
    }

    const legacy = await admin
      .from("education_lessons")
      .select("slug, loom_url, updated_at");
    if (legacy.error || !legacy.data) return map;
    for (const row of legacy.data as LessonRow[]) {
      map.set(row.slug, {
        ...row,
        title: null,
        category_id: null,
        poster_path: null,
        is_custom: false,
        recommended: null,
        created_at: null,
      });
    }
  } catch {
    return map;
  }
  return map;
}
