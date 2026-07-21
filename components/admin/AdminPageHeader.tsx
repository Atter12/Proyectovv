import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-hero admin-page-hero mb-6 flex flex-col justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-[var(--admin-shadow-1)] lg:flex-row lg:items-end lg:p-6">
      <div className="min-w-0">
        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-[var(--admin-accent-soft)] px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--admin-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-accent)]" aria-hidden />
          {eyebrow}
        </div>
        <h1 className="font-display text-2xl font-medium tracking-tight text-[var(--admin-text)] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-4xl text-sm text-[var(--admin-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
