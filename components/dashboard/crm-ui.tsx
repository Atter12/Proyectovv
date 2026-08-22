import Link from "next/link";
import type { ReactNode } from "react";

/** UI CRM (inspirado ImpoERP/oddo) — tokens Holistic vía CSS `.app-*`. */

export function CrmPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-xl font-extrabold tracking-tight text-[var(--auth-text)] md:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--auth-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function CrmStat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <article className="app-stat rounded-[12px] border border-[var(--auth-border)] bg-white px-4 py-4">
      <p className="text-[12px] font-semibold text-[var(--auth-text-soft)]">{label}</p>
      <p
        className={`mt-1.5 font-display text-2xl font-extrabold tabular-nums tracking-tight md:text-[1.75rem] ${
          accent ? "text-[var(--auth-accent)]" : "text-[var(--auth-text)]"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[11px] text-[var(--auth-text-muted)]">{hint}</p>
      ) : null}
    </article>
  );
}

export function CrmPanel({
  title,
  children,
  className = "",
  action,
  subtitle,
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  flush?: boolean;
}) {
  return (
    <section
      className={`rounded-[12px] border border-[var(--auth-border)] bg-white shadow-[0_1px_0_rgb(28_25_23_/_0.04)] ${className}`}
    >
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="font-display text-[15px] font-extrabold text-[var(--auth-text)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-[12px] font-medium text-[var(--auth-text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={title || flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function CrmActionTile({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-[12px] border border-[var(--auth-border)] bg-white p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--auth-accent)]/40"
    >
      <p className="text-[14px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
        {title}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-[var(--auth-text-muted)]">{body}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--auth-accent)]">
        Abrir
        <svg
          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
        </svg>
      </span>
    </Link>
  );
}
