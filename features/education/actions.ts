"use server";

import { revalidatePath } from "next/cache";
import { routes } from "@/config/routes";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import { requireSession } from "@/lib/auth/guards.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  educationLessons,
  isEducationCategoryId,
  isEducationLessonSlug,
  type EducationCategoryId,
} from "./lib/catalog";
import { canonicalLessonVideoUrl } from "./lib/loom";
import { educationLessonSlug, educationPosterKind } from "./lib/media";
import { EDUCATION_POSTER_BUCKET, EDUCATION_VIDEO_BUCKET, educationPosterUrl, educationVideoUrl } from "./lib/poster";
import { isEducationMp4 } from "./lib/video";

export type SaveEducationLoomResult =
  | { ok: true; loomUrl: string | null }
  | {
      ok: false;
      error: "forbidden" | "invalid" | "missing_table" | "unknown";
    };

export type EducationLessonSave = {
  slug: string;
  title: string;
  categoryId: EducationCategoryId;
  number: number;
  loomUrl: string | null;
  posterUrl: string | null;
  videoUrl: string | null;
  custom: boolean;
  recommended: boolean;
};

export type SaveEducationLessonResult =
  | { ok: true; lesson: EducationLessonSave }
  | {
      ok: false;
      error:
        | "forbidden"
        | "invalid"
        | "invalid_title"
        | "invalid_image"
        | "missing_table"
        | "unknown";
    };

export async function saveEducationLoomUrlAction(
  slug: string,
  loomUrl: string,
): Promise<SaveEducationLoomResult> {
  const allowed = await assertEducationEditor();
  if (!allowed.ok) return allowed;

  if (!isEducationLessonSlug(slug)) {
    return { ok: false, error: "invalid" };
  }

  const stored = parseLoom(loomUrl);
  if (stored === "invalid") return { ok: false, error: "invalid" };

  const written = await writeLesson({
    slug,
    loom_url: stored,
    updated_by: allowed.userId,
    updated_at: new Date().toISOString(),
  });
  if (!written.ok) return written;

  revalidateEducation();
  return { ok: true, loomUrl: stored };
}

export async function saveEducationLessonAction(
  formData: FormData,
): Promise<SaveEducationLessonResult> {
  const allowed = await assertEducationEditor();
  if (!allowed.ok) return allowed;

  const slug = String(formData.get("slug") ?? "").trim();
  const title = normalizeTitle(formData.get("title"));
  if (!title) return { ok: false, error: "invalid_title" };
  const loom = parseLoom(String(formData.get("loomUrl") ?? ""));
  if (loom === "invalid") return { ok: false, error: "invalid" };
  const recommended = readRecommended(formData.get("recommended"));

  const catalog = educationLessons.find((lesson) => lesson.slug === slug);
  const existing = catalog ? null : await loadCustomLesson(slug);
  if (!catalog && !existing) return { ok: false, error: "invalid" };

  const file = readPosterFile(formData.get("poster"));
  const uploaded = await storePoster(slug, file);
  if (!uploaded.ok) return uploaded;

  const previousPath = catalog
    ? await loadPosterPath(slug)
    : existing?.poster_path ?? null;

  const written = await writeLesson({
    slug,
    title,
    loom_url: loom,
    poster_path: uploaded.path ?? previousPath,
    is_custom: Boolean(existing),
    category_id: existing?.category_id ?? catalog?.categoryId ?? null,
    recommended,
    updated_by: allowed.userId,
    updated_at: new Date().toISOString(),
  });
  if (!written.ok) {
    if (uploaded.path) await removePoster(uploaded.path);
    return written;
  }

  if (uploaded.path && previousPath && previousPath !== uploaded.path) {
    await removePoster(previousPath);
  }

  revalidateEducation();
  const source = catalog ?? {
    categoryId: existing!.category_id as EducationCategoryId,
    number: existing!.number,
  };
  return {
    ok: true,
    lesson: {
      slug,
      title,
      categoryId: source.categoryId,
      number: source.number,
      loomUrl: loom,
      posterUrl: educationPosterUrl(uploaded.path ?? previousPath),
      videoUrl: await currentVideoUrl(slug),
      custom: Boolean(existing),
      recommended,
    },
  };
}

export async function createEducationLessonAction(
  formData: FormData,
): Promise<SaveEducationLessonResult> {
  const allowed = await assertEducationEditor();
  if (!allowed.ok) return allowed;

  const title = normalizeTitle(formData.get("title"));
  if (!title) return { ok: false, error: "invalid_title" };
  const categoryRaw = String(formData.get("categoryId") ?? "");
  if (!isEducationCategoryId(categoryRaw)) return { ok: false, error: "invalid" };
  const loom = parseLoom(String(formData.get("loomUrl") ?? ""));
  if (loom === "invalid") return { ok: false, error: "invalid" };
  const recommended = readRecommended(formData.get("recommended"));

  const slug = educationLessonSlug(title, crypto.randomUUID().replace(/-/g, "").slice(0, 6));
  const file = readPosterFile(formData.get("poster"));
  const uploaded = await storePoster(slug, file);
  if (!uploaded.ok) return uploaded;

  const number = educationLessons.length + (await countCustomLessons()) + 1;
  const written = await writeLesson({
    slug,
    title,
    category_id: categoryRaw,
    loom_url: loom,
    poster_path: uploaded.path,
    is_custom: true,
    recommended,
    updated_by: allowed.userId,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  if (!written.ok) {
    if (uploaded.path) await removePoster(uploaded.path);
    return written;
  }

  revalidateEducation();
  return {
    ok: true,
    lesson: {
      slug,
      title,
      categoryId: categoryRaw,
      number,
      loomUrl: loom,
      posterUrl: educationPosterUrl(uploaded.path),
      videoUrl: null,
      custom: true,
      recommended,
    },
  };
}

async function assertEducationEditor(): Promise<
  { ok: true; userId: string } | { ok: false; error: "forbidden" }
> {
  const session = await requireSession();
  const funding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  const isAdmin = userIsAllowedAdmin({ id: session.id, email: session.email });
  if (!funding.isStaff && !funding.isSuperAdmin && !isAdmin) {
    return { ok: false, error: "forbidden" };
  }
  return { ok: true, userId: session.id };
}

function readRecommended(value: FormDataEntryValue | null): boolean {
  return String(value ?? "") === "1";
}

export type EducationVideoPrepare =
  | { ok: true; bucket: string; path: string; token: string }
  | { ok: false; error: "forbidden" | "invalid" | "invalid_video" | "unknown" };

export type EducationVideoAttach =
  | { ok: true; videoUrl: string | null }
  | { ok: false; error: "forbidden" | "invalid" | "invalid_video" | "missing_table" | "unknown" };

export async function prepareEducationVideoUploadAction(input: {
  slug: string;
  size: number;
  head: string;
}): Promise<EducationVideoPrepare> {
  const allowed = await assertEducationEditor();
  if (!allowed.ok) return allowed;
  if (!(await lessonSlugExists(input.slug))) return { ok: false, error: "invalid" };

  let head: Uint8Array;
  try {
    head = Uint8Array.from(atob(input.head), (char) => char.charCodeAt(0));
  } catch {
    return { ok: false, error: "invalid_video" };
  }
  if (!isEducationMp4(head, input.size)) return { ok: false, error: "invalid_video" };

  const path = `${input.slug}/${crypto.randomUUID()}.mp4`;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from(EDUCATION_VIDEO_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data?.token) return { ok: false, error: "unknown" };
    return { ok: true, bucket: EDUCATION_VIDEO_BUCKET, path: data.path, token: data.token };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function attachEducationVideoAction(
  slug: string,
  path: string,
): Promise<EducationVideoAttach> {
  const allowed = await assertEducationEditor();
  if (!allowed.ok) return allowed;
  if (!isVideoPathForSlug(slug, path)) return { ok: false, error: "invalid" };

  const previous = await loadVideoPath(slug);
  const written = await writeLesson({
    slug,
    video_path: path,
    updated_by: allowed.userId,
    updated_at: new Date().toISOString(),
  });
  if (!written.ok) return written;
  if (previous && previous !== path) await removeVideo(previous);
  revalidateEducation();
  return { ok: true, videoUrl: educationVideoUrl(path) };
}

export async function clearEducationVideoAction(slug: string): Promise<EducationVideoAttach> {
  const allowed = await assertEducationEditor();
  if (!allowed.ok) return allowed;
  if (!(await lessonSlugExists(slug))) return { ok: false, error: "invalid" };
  const previous = await loadVideoPath(slug);
  const written = await writeLesson({
    slug,
    video_path: null,
    updated_by: allowed.userId,
    updated_at: new Date().toISOString(),
  });
  if (!written.ok) return written;
  if (previous) await removeVideo(previous);
  revalidateEducation();
  return { ok: true, videoUrl: null };
}

function isVideoPathForSlug(slug: string, path: string): boolean {
  return new RegExp(
    `^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[0-9a-f-]{36}\\.mp4$`,
  ).test(path);
}

async function lessonSlugExists(slug: string): Promise<boolean> {
  if (isEducationLessonSlug(slug)) return true;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return false;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("education_lessons")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle<{ slug: string }>();
    return Boolean(data?.slug);
  } catch {
    return false;
  }
}

async function currentVideoUrl(slug: string): Promise<string | null> {
  return educationVideoUrl(await loadVideoPath(slug));
}

async function loadVideoPath(slug: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("education_lessons")
      .select("video_path")
      .eq("slug", slug)
      .maybeSingle<{ video_path: string | null }>();
    return data?.video_path ?? null;
  } catch {
    return null;
  }
}

async function removeVideo(path: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage.from(EDUCATION_VIDEO_BUCKET).remove([path]);
  } catch {
    // The row already points at the new file.
  }
}

function normalizeTitle(value: FormDataEntryValue | null): string | null {
  const title = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!title || title.length > 120) return null;
  return title;
}

function parseLoom(raw: string): string | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return canonicalLessonVideoUrl(trimmed) ?? "invalid";
}

function readPosterFile(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

async function storePoster(
  slug: string,
  file: File | null,
): Promise<{ ok: true; path: string | null } | { ok: false; error: "invalid_image" | "unknown" }> {
  if (!file) return { ok: true, path: null };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = educationPosterKind(bytes, file.type);
  if (!kind) return { ok: false, error: "invalid_image" };
  const path = `${slug}/${crypto.randomUUID()}.${kind === "jpg" ? "jpg" : kind}`;
  const contentType =
    kind === "jpg"
      ? "image/jpeg"
      : kind === "png"
        ? "image/png"
        : kind === "webp"
          ? "image/webp"
          : "image/gif";
  try {
    const admin = createAdminClient();
    const { error } = await admin.storage.from(EDUCATION_POSTER_BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
    });
    if (error) return { ok: false, error: "unknown" };
    return { ok: true, path };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

async function removePoster(path: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.storage.from(EDUCATION_POSTER_BUCKET).remove([path]);
  } catch {
    // The new file is already the one shown.
  }
}

async function loadPosterPath(slug: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("education_lessons")
      .select("poster_path")
      .eq("slug", slug)
      .maybeSingle<{ poster_path: string | null }>();
    return data?.poster_path ?? null;
  } catch {
    return null;
  }
}

async function loadCustomLesson(slug: string): Promise<{
  category_id: EducationCategoryId;
  poster_path: string | null;
  number: number;
} | null> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("education_lessons")
      .select("slug, category_id, poster_path, is_custom, created_at")
      .eq("slug", slug)
      .eq("is_custom", true)
      .maybeSingle<{
        slug: string;
        category_id: string | null;
        poster_path: string | null;
        is_custom: boolean;
        created_at: string | null;
      }>();
    if (!data?.is_custom || !data.category_id || !isEducationCategoryId(data.category_id)) {
      return null;
    }
    const { count } = await admin
      .from("education_lessons")
      .select("slug", { count: "exact", head: true })
      .eq("is_custom", true)
      .lte("created_at", data.created_at ?? new Date().toISOString());
    return {
      category_id: data.category_id,
      poster_path: data.poster_path,
      number: educationLessons.length + (count ?? 1),
    };
  } catch {
    return null;
  }
}

async function countCustomLessons(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("education_lessons")
      .select("slug", { count: "exact", head: true })
      .eq("is_custom", true);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function writeLesson(
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: "missing_table" | "unknown" }> {
  const first = await upsertLesson(payload);
  if (first.ok || !("recommended" in payload) || !first.missingRecommended) return first;
  const { recommended: _ignored, ...withoutRecommended } = payload;
  return upsertLesson(withoutRecommended);
}

async function upsertLesson(
  payload: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: "missing_table" | "unknown"; missingRecommended?: boolean }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("education_lessons").upsert(payload);
    if (!error) return { ok: true };
    const message = error.message.toLowerCase();
    const missingRecommended = message.includes("recommended");
    const missing =
      error.code === "42P01" ||
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      message.includes("education_lessons") ||
      message.includes("poster_path") ||
      message.includes("is_custom") ||
      message.includes("video_path") ||
      missingRecommended;
    return { ok: false, error: missing ? "missing_table" : "unknown", missingRecommended };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

function revalidateEducation(): void {
  revalidatePath(routes.education);
  revalidatePath(routes.adminEducation);
}
