import type { ReactNode } from "react";
import { HecomClienteAvatar } from "@/features/clientes/components/HecomClienteAvatar.client";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  name?: string;
  avatarUrl?: string | null;
  actions?: ReactNode;
};

/** Header uniforme Holistic — tipografía/colores = landing. */
export function ClienteScopePageHeader({
  eyebrow,
  title,
  description,
  name,
  avatarUrl,
  actions,
}: Props) {
  return (
    <div className="dashboard-surface-card overflow-hidden rounded-[1.25rem]">
      <div className="relative px-5 py-5 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-[linear-gradient(180deg,#ff781f,#ffa12c)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.06),transparent)]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4 pl-2">
          <div className="flex min-w-0 items-start gap-3">
            {name ? (
              <HecomClienteAvatar
                name={name}
                avatarUrl={avatarUrl}
                size="md"
                className="ring-1 ring-white shadow-sm"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-[var(--auth-accent)]">
                {eyebrow}
              </p>
              <h1 className="mt-1 text-[1.45rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.65rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-1.5 max-w-2xl text-[15px] font-medium leading-6 text-[var(--auth-text-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function ClienteScopeKpi({
  label,
  value,
  accent = "bg-[var(--auth-accent)]",
  tone = "text-[var(--auth-text)]",
}: {
  label: string;
  value: string;
  accent?: string;
  tone?: string;
}) {
  return (
    <div className="dashboard-kpi relative overflow-hidden rounded-[1.25rem] px-4 py-3.5">
      <span
        aria-hidden
        className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${accent}`}
      />
      <p className="pl-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--auth-text-soft)]">
        {label}
      </p>
      <p
        className={`mt-1 truncate pl-2 text-[1.35rem] font-bold tracking-[-0.03em] tabular-nums ${tone}`}
      >
        {value}
      </p>
    </div>
  );
}
