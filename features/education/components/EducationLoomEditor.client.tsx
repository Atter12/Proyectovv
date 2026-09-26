"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createEducationLessonAction,
  saveEducationLessonAction,
  type EducationLessonSave,
} from "../actions";
import { educationCategories, educationCategoryById } from "../lib/catalog";
import type { EducationCategoryId } from "../lib/catalog";
import type { EducationLessonView } from "../lib/types";

export function EducationLoomEditor({
  lessons,
  tone = "dashboard",
  onSaved,
  onCreated,
}: {
  lessons: EducationLessonView[];
  tone?: "dashboard" | "admin";
  onSaved?: (lesson: EducationLessonSave) => void;
  onCreated?: (lesson: EducationLessonSave) => void;
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
      <AddLessonForm tone={tone} onCreated={onCreated} />
      <ul className="mt-4 space-y-3">
        {lessons.map((lesson) => (
          <li key={lesson.slug}>
            <LessonEditor lesson={lesson} tone={tone} onSaved={onSaved} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddLessonForm({
  tone,
  onCreated,
}: {
  tone: "dashboard" | "admin";
  onCreated?: (lesson: EducationLessonSave) => void;
}) {
  const t = useTranslations("education");
  const router = useRouter();
  const admin = tone === "admin";
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<EducationCategoryId>("empieza");
  const [loomUrl, setLoomUrl] = useState("");
  const [recommended, setRecommended] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileEpoch, setFileEpoch] = useState(0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    setError(null);
    const form = new FormData();
    form.set("title", title);
    form.set("categoryId", categoryId);
    form.set("loomUrl", loomUrl);
    form.set("recommended", recommended ? "1" : "0");
    if (file) form.set("poster", file);
    const result = await createEducationLessonAction(form);
    setPending(false);
    if (!result.ok) {
      setError(t(`saveError.${result.error}`));
      return;
    }
    setTitle("");
    setLoomUrl("");
    setRecommended(false);
    setCategoryId("empieza");
    setFile(null);
    setFileEpoch((value) => value + 1);
    setFeedback(t("lessonAdded"));
    onCreated?.(result.lesson);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className={
        admin
          ? "mt-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3"
          : "mt-4 rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-bg)] p-3"
      }
    >
      <p className={admin ? "font-semibold text-[var(--admin-text)]" : "font-semibold text-[var(--auth-text)]"}>
        {t("addTitle")}
      </p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Field label={t("titleLabel")} htmlFor="edu-new-title" admin={admin}>
          <input
            id="edu-new-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setFeedback(null);
              setError(null);
            }}
            placeholder={t("titlePlaceholder")}
            maxLength={120}
            className={inputClass(admin)}
          />
        </Field>
        <Field label={t("categoryLabel")} htmlFor="edu-new-category" admin={admin}>
          <select
            id="edu-new-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value as EducationCategoryId)}
            className={inputClass(admin)}
          >
            {educationCategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("loomLabelShort")} htmlFor="edu-new-loom" admin={admin} wide>
          <input
            id="edu-new-loom"
            value={loomUrl}
            onChange={(event) => setLoomUrl(event.target.value)}
            placeholder={t("loomPlaceholder")}
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            className={inputClass(admin)}
          />
        </Field>
        <PosterField
          key={fileEpoch}
          id="edu-new-poster"
          admin={admin}
          preview={preview}
          onFile={setFile}
        />
        <RecommendedToggle
          id="edu-new-recommended"
          checked={recommended}
          admin={admin}
          onChange={setRecommended}
        />
      </div>
      <FormStatus error={error} feedback={feedback} />
      <button type="submit" disabled={pending} className={buttonClass(admin)}>
        {pending ? t("adding") : t("addLesson")}
      </button>
    </form>
  );
}

function LessonEditor({
  lesson,
  tone,
  onSaved,
}: {
  lesson: EducationLessonView;
  tone: "dashboard" | "admin";
  onSaved?: (lesson: EducationLessonSave) => void;
}) {
  const t = useTranslations("education");
  const router = useRouter();
  const admin = tone === "admin";
  const [title, setTitle] = useState(lesson.title);
  const [loomUrl, setLoomUrl] = useState(lesson.loomUrl ?? "");
  const [recommended, setRecommended] = useState(lesson.recommended);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileEpoch, setFileEpoch] = useState(0);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const category = educationCategoryById(lesson.categoryId);

  useEffect(() => {
    setTitle(lesson.title);
    setLoomUrl(lesson.loomUrl ?? "");
    setRecommended(lesson.recommended);
  }, [lesson.title, lesson.loomUrl, lesson.recommended]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    setError(null);
    const form = new FormData();
    form.set("slug", lesson.slug);
    form.set("title", title);
    form.set("loomUrl", loomUrl);
    form.set("recommended", recommended ? "1" : "0");
    if (file) form.set("poster", file);
    const result = await saveEducationLessonAction(form);
    setPending(false);
    if (!result.ok) {
      setError(t(`saveError.${result.error}`));
      return;
    }
    setFile(null);
    setFileEpoch((value) => value + 1);
    setTitle(result.lesson.title);
    setLoomUrl(result.lesson.loomUrl ?? "");
    setFeedback(t("savedLesson"));
    onSaved?.(result.lesson);
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className={
        admin
          ? "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)] p-3"
          : "rounded-2xl border border-[var(--auth-border)] bg-[var(--auth-bg)] p-3"
      }
    >
      <p className={admin ? "text-xs text-[var(--admin-text-muted)]" : "text-xs text-[var(--auth-text-muted)]"}>
        {lesson.number}. {category.label}
        {" · "}
        {lesson.embedUrl ? t("ready") : t("pending")}
      </p>
      <div className="mt-2 grid gap-3 lg:grid-cols-[7.5rem_minmax(0,1fr)]">
        <img
          src={preview || lesson.posterUrl || "/education/poster.svg"}
          alt=""
          className="h-[4.6rem] w-full rounded-xl object-cover"
        />
        <div className="grid gap-2">
          <Field label={t("titleLabel")} htmlFor={`title-${lesson.slug}`} admin={admin}>
            <input
              id={`title-${lesson.slug}`}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setFeedback(null);
                setError(null);
              }}
              maxLength={120}
              className={inputClass(admin)}
            />
          </Field>
          <Field label={t("loomLabelShort")} htmlFor={`loom-${lesson.slug}`} admin={admin}>
            <input
              id={`loom-${lesson.slug}`}
              value={loomUrl}
              onChange={(event) => {
                setLoomUrl(event.target.value);
                setFeedback(null);
                setError(null);
              }}
              placeholder={t("loomPlaceholder")}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              className={inputClass(admin)}
            />
          </Field>
          <PosterField
            key={`${lesson.slug}-${fileEpoch}`}
            id={`poster-${lesson.slug}`}
            admin={admin}
            preview={null}
            onFile={setFile}
          />
          <RecommendedToggle
            id={`recommended-${lesson.slug}`}
            checked={recommended}
            admin={admin}
            onChange={setRecommended}
          />
        </div>
      </div>
      <FormStatus error={error} feedback={feedback} />
      <button type="submit" disabled={pending} className={buttonClass(admin)}>
        {pending ? t("saving") : t("saveLink")}
      </button>
    </form>
  );
}

function RecommendedToggle({
  id,
  checked,
  admin,
  onChange,
}: {
  id: string;
  checked: boolean;
  admin: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useTranslations("education");
  return (
    <label
      htmlFor={id}
      className={
        admin
          ? "flex items-center gap-2 text-sm font-medium text-[var(--admin-text)]"
          : "flex items-center gap-2 text-sm font-medium text-[var(--auth-text)]"
      }
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--auth-accent)]"
      />
      {t("recommendedToggle")}
    </label>
  );
}

function PosterField({
  id,
  admin,
  preview,
  onFile,
}: {
  id: string;
  admin: boolean;
  preview: string | null;
  onFile: (file: File | null) => void;
}) {
  const t = useTranslations("education");
  return (
    <Field label={t("imageLabel")} htmlFor={id} admin={admin} wide>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        className={
          admin
            ? "block w-full text-sm text-[var(--admin-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--admin-text)]"
            : "block w-full text-sm text-[var(--auth-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--auth-text)]"
        }
      />
      {preview ? (
        <img src={preview} alt="" className="mt-2 h-24 w-40 rounded-xl object-cover" />
      ) : (
        <p className={admin ? "mt-1 text-xs text-[var(--admin-text-muted)]" : "mt-1 text-xs text-[var(--auth-text-muted)]"}>
          {t("imageHint")}
        </p>
      )}
    </Field>
  );
}

function Field({
  label,
  htmlFor,
  admin,
  wide = false,
  children,
}: {
  label: string;
  htmlFor: string;
  admin: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={wide ? "min-w-0 lg:col-span-2" : "min-w-0"}>
      <label
        htmlFor={htmlFor}
        className={
          admin
            ? "mb-1 block text-xs font-semibold text-[var(--admin-text)]"
            : "mb-1 block text-xs font-semibold text-[var(--auth-text)]"
        }
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function FormStatus({ error, feedback }: { error: string | null; feedback: string | null }) {
  if (error) return <p className="mt-2 text-xs font-medium text-red-600">{error}</p>;
  if (feedback) return <p className="mt-2 text-xs font-medium text-emerald-700">{feedback}</p>;
  return null;
}

function inputClass(admin: boolean): string {
  return admin
    ? "h-10 w-full rounded-xl border border-[var(--admin-control-border)] bg-[var(--admin-control-bg)] px-3 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-accent)]"
    : "h-10 w-full rounded-xl border border-[var(--auth-input-border)] bg-white px-3 text-sm text-[var(--auth-text)] outline-none focus:border-[var(--auth-accent)]";
}

function buttonClass(admin: boolean): string {
  return admin
    ? "mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--admin-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
    : "mt-3 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50";
}
