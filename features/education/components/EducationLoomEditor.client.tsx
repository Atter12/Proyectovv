"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { saveEducationLoomUrlAction } from "../actions";
import { educationCategoryById } from "../lib/catalog";
import type { EducationLessonView } from "../lib/types";

export function EducationLoomEditor({
  lessons,
  tone = "dashboard",
  onSaved,
}: {
  lessons: EducationLessonView[];
  tone?: "dashboard" | "admin";
  onSaved?: (slug: string, loomUrl: string | null) => void;
}) {
  const t = useTranslations("education");
  const admin = tone === "admin";

  return (
    <div
      className={
        admin
          ? "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)] sm:p-5"
          : "rounded-[1.25rem] border border-[var(--auth-border)] bg-white p-4 shadow-[0_20px_40px_-28px_rgb(28_25_23_/_0.16)] sm:p-5"
      }
    >
      <h2
        className={
          admin
            ? "text-lg font-semibold text-[var(--admin-text)]"
            : "text-[1.05rem] font-bold text-[var(--auth-text)]"
        }
      >
        {t("editorTitle")}
      </h2>
      <p
        className={
          admin
            ? "mt-1 max-w-3xl text-sm text-[var(--admin-text-muted)]"
            : "mt-1 max-w-3xl text-[13px] leading-5 text-[var(--auth-text-muted)]"
        }
      >
        {t("editorHint")}
      </p>
      <ul className="mt-4 space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.slug}>
            <LoomRow lesson={lesson} tone={tone} onSaved={onSaved} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function LoomRow({
  lesson,
  tone,
  onSaved,
}: {
  lesson: EducationLessonView;
  tone: "dashboard" | "admin";
  onSaved?: (slug: string, loomUrl: string | null) => void;
}) {
  const t = useTranslations("education");
  const router = useRouter();
  const [value, setValue] = useState(lesson.loomUrl ?? "");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const admin = tone === "admin";
  const category = educationCategoryById(lesson.categoryId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    setError(null);
    const result = await saveEducationLoomUrlAction(lesson.slug, value);
    setPending(false);
    if (!result.ok) {
      setError(t(`saveError.${result.error}`));
      return;
    }
    setValue(result.loomUrl ?? "");
    setFeedback(result.loomUrl ? t("saved") : t("cleared"));
    onSaved?.(lesson.slug, result.loomUrl);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className={
        admin
          ? "grid gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,1.2fr)_auto] lg:items-center"
          : "grid gap-2 rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-bg)] p-3 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,1.2fr)_auto] lg:items-center"
      }
    >
      <div className="min-w-0">
        <p className={admin ? "font-semibold text-[var(--admin-text)]" : "font-semibold text-[var(--auth-text)]"}>
          {lesson.number}. {lesson.title}
        </p>
        <p className={admin ? "text-xs text-[var(--admin-text-muted)]" : "text-xs text-[var(--auth-text-muted)]"}>
          {category.label}
          {" · "}
          {lesson.embedUrl ? t("ready") : t("pending")}
        </p>
      </div>
      <div className="min-w-0">
        <label className="sr-only" htmlFor={`loom-${lesson.slug}`}>
          {t("loomLabel", { title: lesson.title })}
        </label>
        <input
          id={`loom-${lesson.slug}`}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setFeedback(null);
            setError(null);
          }}
          placeholder={t("loomPlaceholder")}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className={
            admin
              ? "h-10 w-full rounded-xl border border-[var(--admin-control-border)] bg-[var(--admin-control-bg)] px-3 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-accent)]"
              : "h-10 w-full rounded-xl border border-[var(--auth-input-border)] bg-white px-3 text-sm text-[var(--auth-text)] outline-none focus:border-[var(--auth-accent)]"
          }
        />
        {error ? <p className="mt-1 text-xs font-medium text-red-600">{error}</p> : null}
        {feedback ? (
          <p className="mt-1 text-xs font-medium text-emerald-700">{feedback}</p>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={pending}
        className={
          admin
            ? "inline-flex h-10 items-center justify-center rounded-xl bg-[var(--admin-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
            : "inline-flex h-10 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
        }
      >
        {pending ? t("saving") : t("saveLink")}
      </button>
    </form>
  );
}
