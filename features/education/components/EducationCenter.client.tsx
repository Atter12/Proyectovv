"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
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
          icon={<CategoryGlyph id="all" />}
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
              icon={<CategoryGlyph id={item.id} />}
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
          ? "flex min-h-[128px] flex-col items-center justify-center gap-3 rounded-[1.15rem] border border-[var(--auth-accent)] bg-[#fff7f1] px-3 py-4 text-center"
          : "flex min-h-[128px] flex-col items-center justify-center gap-3 rounded-[1.15rem] border border-[var(--auth-border)] bg-white px-3 py-4 text-center"
      }
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-[13px] font-bold leading-4 text-[var(--auth-text)]">{label}</span>
        <span className="mt-0.5 block text-[11px] font-medium text-[var(--auth-text-soft)]">{countLabel}</span>
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

const glyphTone: Record<CategoryFilter, string> = {
  all: "bg-[#d47840] text-white shadow-[inset_0_-1px_0_rgb(0_0_0_/_0.08)]",
  empieza: "bg-[#fff1e4] text-[#e85d04]",
  plataforma: "bg-[#f4efe8] text-[#1c1917]",
  tiktok: "bg-[#f2f2f2] text-[#111111]",
  shopify: "bg-[#eaf6df] text-[#7ab55c]",
  ayuda: "bg-[#fff0ea] text-[#e4572e]",
};

function CategoryGlyph({ id }: { id: CategoryFilter }) {
  return (
    <span
      className={`grid h-[3.25rem] w-[3.25rem] place-items-center rounded-[1.05rem] ${glyphTone[id]}`}
      aria-hidden
    >
      {id === "all" ? <GridIcon /> : null}
      {id === "empieza" ? <RocketIcon /> : null}
      {id === "plataforma" ? <MonitorIcon /> : null}
      {id === "tiktok" ? <TikTokIcon /> : null}
      {id === "shopify" ? <ShopifyBagIcon /> : null}
      {id === "ayuda" ? <LifeRingIcon /> : null}
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

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
      <rect x="2.2" y="2.2" width="8.2" height="8.2" rx="2.1" />
      <rect x="13.6" y="2.2" width="8.2" height="8.2" rx="2.1" />
      <rect x="2.2" y="13.6" width="8.2" height="8.2" rx="2.1" />
      <rect x="13.6" y="13.6" width="8.2" height="8.2" rx="2.1" />
    </svg>
  );
}

function RocketIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <g transform="translate(12 12) scale(1.18) translate(-12 -12) rotate(-38 12 12)" fill="currentColor">
        <path d="M12 2.2c1.5 2.5 2 5.3 1.6 8l-.3 1.8h-2.6l-.3-1.8C9.9 7.5 10.5 4.7 12 2.2Z" />
        <path d="M8.3 10.4 6.1 13.8 9.5 12.4 8.3 10.4ZM15.7 10.4 17.9 13.8 14.5 12.4 15.7 10.4Z" />
        <path d="M10.6 12.6h2.8l.5 2.7-1.9 1.8-1.9-1.8.5-2.7Z" />
        <circle cx="12" cy="7.2" r="1.05" fill="#fff1e4" />
      </g>
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
      <path d="M4.2 4.4A2.2 2.2 0 0 1 6.4 2.2h11.2a2.2 2.2 0 0 1 2.2 2.2v8.1a2.2 2.2 0 0 1-2.2 2.2H6.4a2.2 2.2 0 0 1-2.2-2.2V4.4Z" />
      <path d="M9.2 14.6h5.6v1.5a1 1 0 0 1-1 1h-3.6a1 1 0 0 1-1-1v-1.5Z" opacity="0.45" />
      <path d="M8 18.7h8a1.05 1.05 0 0 1 0 2.1H8a1.05 1.05 0 0 1 0-2.1Z" />
      <rect x="6.3" y="4.5" width="11.4" height="6.4" rx="1" fill="#f4efe8" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="#111111" aria-hidden>
      <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
    </svg>
  );
}

function ShopifyBagIcon() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <path
        fill="none"
        stroke="#96bf48"
        strokeWidth="2.15"
        strokeLinecap="round"
        d="M12.2 14.4V10.6a3.8 3.8 0 0 1 7.6 0v3.8"
      />
      <path
        fill="#96bf48"
        d="M8.3 13.2h15.4c.5 0 .8.4.8.8l-1.45 12.2a2.3 2.3 0 0 1-2.3 2H11.25a2.3 2.3 0 0 1-2.3-2L7.5 14c0-.4.4-.8.8-.8Z"
      />
      <ellipse cx="16" cy="13.55" rx="6.55" ry="1.45" fill="#7eae3a" />
      <path
        fill="#fff"
        d="M17.55 17.15c-.35-.85-1.15-1.25-2.15-1.15-1.25.1-2 .75-2 1.55 0 .7.55 1.1 1.85 1.5 1.55.45 2.55 1.05 2.55 2.4 0 1.45-1.2 2.45-3.05 2.45-1.55 0-2.7-.7-3.15-1.9l1.85-.7c.25.6.85 1 1.55 1 .85 0 1.35-.4 1.35-.95 0-.6-.5-.95-1.75-1.35-1.55-.5-2.7-1.15-2.7-2.55 0-1.4 1.2-2.4 3-2.4 1.4 0 2.45.55 2.9 1.7l-1.65.45Z"
      />
    </svg>
  );
}

function LifeRingIcon() {
  const rawId = useId().replace(/:/g, "");
  const maskId = `edu-life-${rawId}`;

  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <mask id={maskId}>
        <rect width="24" height="24" fill="#fff" />
        <circle cx="12" cy="12" r="3.15" fill="#000" />
        <path
          stroke="#000"
          strokeWidth="2.35"
          strokeLinecap="round"
          d="M5.1 5.1 8.7 8.7M15.3 15.3 18.9 18.9M18.9 5.1 15.3 8.7M8.7 15.3 5.1 18.9"
        />
      </mask>
      <circle cx="12" cy="12" r="9" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
