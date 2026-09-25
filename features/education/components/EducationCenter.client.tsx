"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  educationCategories,
  educationCategoryById,
  type EducationCategoryId,
} from "../lib/catalog";
import { loomEmbedUrl } from "../lib/loom";
import type { EducationLessonView } from "../lib/types";
import { EducationLoomEditor } from "./EducationLoomEditor.client";
import { EducationPlayerDialog } from "./EducationPlayerDialog.client";

type CategoryFilter = "all" | EducationCategoryId;

export function EducationCenter({
  lessons,
  canManage,
}: {
  lessons: EducationLessonView[];
  canManage: boolean;
}) {
  const t = useTranslations("education");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [listing, setListing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState<EducationLessonView | null>(null);
  const [links, setLinks] = useState<Record<string, string | null>>({});

  const published = useMemo(
    () =>
      lessons.map((lesson) => {
        if (!(lesson.slug in links)) return lesson;
        const loomUrl = links[lesson.slug] ?? null;
        return { ...lesson, loomUrl, embedUrl: loomEmbedUrl(loomUrl) };
      }),
    [lessons, links],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return published.filter((lesson) => {
      if (category !== "all" && lesson.categoryId !== category) return false;
      if (!needle) return true;
      const label = educationCategoryById(lesson.categoryId).label.toLowerCase();
      return (
        lesson.title.toLowerCase().includes(needle) ||
        lesson.description.toLowerCase().includes(needle) ||
        label.includes(needle)
      );
    });
  }, [published, query, category]);

  const browsing = category === "all" && query.trim().length === 0 && !listing;
  const recommended = published.filter((lesson) => lesson.recommended);
  const latest = [...published].sort((a, b) => {
    const left = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const right = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    if (left !== right) return right - left;
    return b.number - a.number;
  });

  function resetFilters() {
    setQuery("");
    setCategory("all");
    setListing(false);
  }

  function showAllLessons() {
    setQuery("");
    setCategory("all");
    setListing(true);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-[1.7rem] font-bold leading-tight tracking-[-0.04em] text-[var(--auth-text)] sm:text-[2rem]">
            {t("title")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-6 text-[var(--auth-text-muted)]">
            {t("subtitle")}
          </p>
        </div>
        <p className="max-w-[16rem] text-[15px] font-semibold leading-snug text-[var(--auth-text)] sm:text-right">
          {t("taglineLead")}{" "}
          <span className="relative inline-block">
            {t("taglineAccent")}
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-[var(--auth-accent)]"
            />
          </span>
        </p>
      </header>

      {canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-medium text-[var(--auth-text-muted)]">
            {t("manageHint")}
          </p>
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)]"
          >
            {editing ? t("manageClose") : t("manageToggle")}
          </button>
        </div>
      ) : null}

      {canManage && editing ? (
        <EducationLoomEditor
          lessons={published}
          onSaved={(slug, loomUrl) =>
            setLinks((current) => ({ ...current, [slug]: loomUrl }))
          }
        />
      ) : null}

      <form
        className="flex flex-col gap-2 rounded-[1.25rem] border border-[var(--auth-border)] bg-white p-2 shadow-[0_16px_32px_-24px_rgb(28_25_23_/_0.2)] lg:flex-row lg:items-center"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t("searchLabel")}</span>
          <SearchIcon />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-12 w-full rounded-xl bg-transparent pl-11 pr-3 text-[14px] text-[var(--auth-text)] outline-none placeholder:text-[var(--auth-text-soft)]"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--auth-accent)] px-6 text-[14px] font-semibold text-white"
        >
          {t("search")}
        </button>
        <label className="min-w-0 lg:w-[15.5rem]">
          <span className="sr-only">{t("categoryLabel")}</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            className="h-12 w-full rounded-xl border border-[var(--auth-input-border)] bg-white px-3 text-[14px] font-medium text-[var(--auth-text)] outline-none"
          >
            <option value="all">{t("allCategories")}</option>
            {educationCategories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <CategoryChip
          active={category === "all"}
          label={t("all")}
          countLabel={t("videoCount", { count: published.length })}
          onClick={resetFilters}
          icon={<CategoryGlyph id="all" active />}
        />
        {educationCategories.map((item) => {
          const count = published.filter((lesson) => lesson.categoryId === item.id).length;
          return (
            <CategoryChip
              key={item.id}
              active={category === item.id}
              label={item.label}
              countLabel={t("videoCount", { count })}
              onClick={() => setCategory(item.id)}
              icon={<CategoryGlyph id={item.id} active={category === item.id} />}
            />
          );
        })}
      </div>

      {browsing ? (
        <>
          <Section
            title={t("recommendedTitle")}
            subtitle={t("recommendedSubtitle")}
            action={t("seeAll")}
            onAction={showAllLessons}
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recommended.map((lesson) => (
                <LessonCard key={lesson.slug} lesson={lesson} onOpen={setActive} />
              ))}
            </div>
          </Section>

          <Section
            title={t("exploreTitle")}
            action={t("seeAllCategories")}
            onAction={resetFilters}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {educationCategories.map((item) => {
                const count = published.filter((lesson) => lesson.categoryId === item.id).length;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id)}
                    className="rounded-[1.15rem] border border-[var(--auth-border)] bg-white p-4 text-left shadow-[0_12px_28px_-24px_rgb(28_25_23_/_0.35)] transition-colors hover:border-[rgb(212_120_64_/_0.4)]"
                  >
                    <CategoryGlyph id={item.id} />
                    <p className="mt-3 font-bold text-[var(--auth-text)]">{item.label}</p>
                    <p className="mt-0.5 text-[12px] font-medium text-[var(--auth-text-soft)]">
                      {t("videoCount", { count })}
                    </p>
                    <p className="mt-2 text-[13px] leading-5 text-[var(--auth-text-muted)]">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title={t("latestTitle")} action={t("seeAll")} onAction={showAllLessons}>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {latest.map((lesson) => (
                <div key={lesson.slug} className="w-[220px] shrink-0 sm:w-[240px]">
                  <LessonCard lesson={lesson} onOpen={setActive} compact />
                </div>
              ))}
            </div>
          </Section>
        </>
      ) : (
        <Section
          title={
            category === "all"
              ? t("resultsTitle")
              : educationCategoryById(category).label
          }
          subtitle={t("videoCount", { count: filtered.length })}
          action={t("clearFilters")}
          onAction={resetFilters}
        >
          {filtered.length === 0 ? (
            <p className="rounded-[1.15rem] border border-dashed border-[var(--auth-border)] bg-white px-4 py-10 text-center text-[14px] font-medium text-[var(--auth-text-muted)]">
              {t("empty")}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filtered.map((lesson) => (
                <LessonCard key={lesson.slug} lesson={lesson} onOpen={setActive} />
              ))}
            </div>
          )}
        </Section>
      )}

      <EducationPlayerDialog
        lesson={active}
        canManage={canManage}
        onClose={() => setActive(null)}
      />
    </div>
  );
}

function Section({
  title,
  subtitle,
  action,
  onAction,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="text-[1.2rem] font-bold tracking-[-0.03em] text-[var(--auth-text)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-[13px] text-[var(--auth-text-muted)]">{subtitle}</p>
          ) : null}
        </div>
        {action && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-[13px] font-semibold text-[var(--auth-accent)]"
          >
            {action} →
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CategoryChip({
  active,
  label,
  countLabel,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  countLabel: string;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "flex min-h-[92px] flex-col items-start justify-between rounded-[1.1rem] border border-[var(--auth-accent)] bg-[var(--auth-accent)] px-3 py-3 text-left text-white"
          : "flex min-h-[92px] flex-col items-start justify-between rounded-[1.1rem] border border-[var(--auth-border)] bg-white px-3 py-3 text-left"
      }
    >
      {icon}
      <span className="mt-2 min-w-0">
        <span className={`block truncate text-[13px] font-bold ${active ? "text-white" : "text-[var(--auth-text)]"}`}>{label}</span>
        <span className={`block text-[11px] font-medium ${active ? "text-white/80" : "text-[var(--auth-text-soft)]"}`}>{countLabel}</span>
      </span>
    </button>
  );
}

function LessonCard({
  lesson,
  onOpen,
  compact = false,
}: {
  lesson: EducationLessonView;
  onOpen: (lesson: EducationLessonView) => void;
  compact?: boolean;
}) {
  const t = useTranslations("education");
  const category = educationCategoryById(lesson.categoryId);

  return (
    <button
      type="button"
      onClick={() => onOpen(lesson)}
      className="group block w-full text-left"
      aria-label={t("openLesson", { title: lesson.title })}
    >
      <span className="relative block aspect-video overflow-hidden rounded-[1.05rem] bg-[#2a211c]">
        <img
          src="/education/poster.svg"
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(28_25_23_/_0.05),rgb(28_25_23_/_0.28))]" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--auth-text)] shadow-[0_10px_24px_-12px_rgb(28_25_23_/_0.6)]">
            <PlayIcon />
          </span>
        </span>
      </span>
      <span className={`mt-3 block font-bold leading-snug text-[var(--auth-text)] ${compact ? "text-[13px]" : "text-[14px]"}`}>
        {lesson.number}. {lesson.title}
      </span>
      {compact ? null : (
        <span className="mt-1 block text-[13px] leading-5 text-[var(--auth-text-muted)]">
          {lesson.description}
        </span>
      )}
      <span className="mt-2 block text-[12px] font-semibold text-[var(--auth-accent)]">
        {category.label}
      </span>
    </button>
  );
}

function CategoryGlyph({ id, active = false }: { id: CategoryFilter; active?: boolean }) {
  const className = "h-5 w-5";
  const wrap = active
    ? "grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-white"
    : "grid h-9 w-9 place-items-center rounded-xl bg-[var(--auth-accent-soft)] text-[var(--auth-accent)]";

  return (
    <span className={wrap} aria-hidden>
      {id === "all" ? <GridIcon className={className} /> : null}
      {id === "empieza" ? <RocketIcon className={className} /> : null}
      {id === "plataforma" ? <MonitorIcon className={className} /> : null}
      {id === "tiktok" ? <NoteIcon className={className} /> : null}
      {id === "shopify" ? <BagIcon className={className} /> : null}
      {id === "ayuda" ? <LifeRingIcon className={className} /> : null}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--auth-text-soft)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
    </svg>
  );
}

function GridIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

function RocketIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-4 4M9 14l-2 5 5-2M14.5 4.5c2.5 0 5 2.5 5 5-3.2.4-6.4 1.5-8.8 3.9-1.2 1.2-2 2.8-2.4 4.4.2-3.2 1.5-6.2 3.8-8.5 2.2-2.1 4.4-3.3 2.4-4.8z" />
    </svg>
  );
}

function MonitorIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="12" rx="2" />
      <path strokeLinecap="round" d="M8 20h8M12 16.5V20" />
    </svg>
  );
}

function NoteIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V6.5l10-2V16" />
      <circle cx="7" cy="18" r="2.2" />
      <circle cx="17" cy="16" r="2.2" />
    </svg>
  );
}

function BagIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h12l-1 12H7L6 8z" />
      <path strokeLinecap="round" d="M9 8V7a3 3 0 016 0v1" />
    </svg>
  );
}

function LifeRingIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path strokeLinecap="round" d="M7.2 7.2l2.1 2.1M14.7 14.7l2.1 2.1M16.8 7.2l-2.1 2.1M9.3 14.7l-2.1 2.1" />
    </svg>
  );
}
