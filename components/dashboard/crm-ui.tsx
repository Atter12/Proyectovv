import Link from "next/link";
import type { ReactNode } from "react";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

/** UI operativa Ads Holistic — consola SaaS, sin cardificación excesiva. */

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
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--auth-divider)] pb-5">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[1.125rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.25rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--auth-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function CrmMetricCell({
  label,
  value,
  hint,
  emphasis = "default",
  className = "",
  align = "left",
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: "primary" | "default" | "muted";
  className?: string;
  align?: "left" | "center";
}) {
  const valueClass =
    emphasis === "primary"
      ? "text-[1.5rem] font-bold leading-none text-[var(--auth-text)] sm:text-[1.625rem]"
      : emphasis === "muted"
        ? "text-[1.25rem] font-semibold leading-none text-[var(--auth-text-muted)]"
        : "text-[1.375rem] font-semibold leading-none text-[var(--auth-text)]";

  return (
    <div
      className={`min-w-0 px-4 py-3.5 sm:px-5 sm:py-4 ${
        align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
        {label}
      </p>
      <p className={`mt-1.5 tabular-nums tracking-[-0.03em] ${valueClass}`}>{value}</p>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--auth-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function CrmMetricRow({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    hint?: string;
    emphasis?: "primary" | "default" | "muted";
  }>;
}) {
  const cols = Math.min(Math.max(items.length, 1), 4);
  return (
    <CrmMetricsStrip>
      <div
        className="grid divide-y divide-[var(--auth-divider)] sm:divide-x sm:divide-y-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <CrmMetricCell
            key={item.label}
            {...item}
            align="center"
            className="sm:text-left"
          />
        ))}
      </div>
    </CrmMetricsStrip>
  );
}

export function CrmMetricsStrip({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--auth-border)] bg-white">
      {children}
    </section>
  );
}

export function CrmAsideStat({
  label,
  value,
  detail,
  valueClassName = "text-[var(--auth-text)]",
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
        {label}
      </p>
      <p
        className={`mt-1 text-[1.75rem] font-bold leading-none tracking-[-0.03em] tabular-nums sm:text-[2rem] ${valueClassName}`}
      >
        {value}
      </p>
      {detail ? (
        <div className="mt-2 text-[12px] text-[var(--auth-text-muted)]">{detail}</div>
      ) : null}
    </div>
  );
}

export function CrmScopeHero({
  module,
  title,
  cliente,
  meta,
  badge,
  actions,
  aside,
}: {
  module: string;
  title: string;
  cliente?: {
    name: string;
    avatarUrl?: string | null;
    biz?: string | null;
  };
  meta?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--auth-divider)] pb-5 sm:pb-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {cliente ? (
              <HecomClienteAvatar
                name={cliente.name}
                avatarUrl={cliente.avatarUrl}
                size="lg"
                className="ring-2 ring-white"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
                  {module}
                </p>
                {badge}
              </div>
              <h1 className="mt-1 text-[1.125rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.25rem]">
                {title}
              </h1>
              {cliente?.biz || meta ? (
                <p className="mt-1 truncate text-[12px] text-[var(--auth-text-muted)]">
                  {cliente?.biz ? (
                    <span className="font-medium text-[var(--auth-text)]">
                      {cliente.biz}
                    </span>
                  ) : null}
                  {cliente?.biz && meta ? (
                    <span className="mx-1.5 text-[var(--auth-text-soft)]">·</span>
                  ) : null}
                  {meta}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div>
          ) : null}
        </div>
        {aside ? (
          <div className="lg:min-w-[220px] lg:border-l lg:border-[var(--auth-divider)] lg:pl-8">
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function CrmHeroButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const className =
    variant === "primary"
      ? "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--auth-accent)] px-4 text-[13px] font-semibold text-white transition-[filter] hover:brightness-[1.04] sm:w-auto"
      : variant === "secondary"
        ? "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--auth-border)] bg-white px-4 text-[13px] font-semibold text-[var(--auth-text)] transition-colors hover:border-[var(--auth-text-soft)] sm:w-auto"
        : "inline-flex h-10 w-full items-center justify-center rounded-lg px-3 text-[13px] font-medium text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)] sm:w-auto";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function CrmQuickLinks({
  links,
}: {
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <nav
      className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]"
      aria-label="Accesos rápidos"
    >
      <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
        Accesos
      </span>
      {links.map((link, index) => (
        <span key={link.href} className="inline-flex items-center">
          {index > 0 ? (
            <span className="mx-2 text-[var(--auth-text-soft)]" aria-hidden>
              ·
            </span>
          ) : null}
          <Link
            href={link.href}
            className="font-medium text-[var(--auth-text-muted)] transition-colors hover:text-[var(--auth-text)]"
          >
            {link.label}
          </Link>
        </span>
      ))}
    </nav>
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
      className={`overflow-hidden rounded-lg border border-[var(--auth-border)] bg-white ${className}`}
    >
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--auth-divider)] px-4 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
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

/** @deprecated Prefer CrmMetricsStrip + CrmMetricCell */
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
    <CrmMetricCell
      label={label}
      value={value}
      hint={hint}
      emphasis={accent ? "primary" : "default"}
    />
  );
}

/** @deprecated Prefer CrmQuickLinks */
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
      className="block rounded-lg border border-[var(--auth-border)] bg-white p-4 transition-colors hover:border-[var(--auth-text-soft)]"
    >
      <p className="text-[14px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
        {title}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-[var(--auth-text-muted)]">{body}</p>
    </Link>
  );
}
