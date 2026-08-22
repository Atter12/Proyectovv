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

/** Header de sección — alineado a consola operativa Holistic. */
export function ClienteScopePageHeader({
  eyebrow,
  title,
  description,
  name,
  avatarUrl,
  actions,
}: Props) {
  return (
    <header className="border-b border-[var(--auth-divider)] pb-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {name ? (
            <HecomClienteAvatar
              name={name}
              avatarUrl={avatarUrl}
              size="md"
              className="ring-1 ring-white"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--auth-text-soft)]">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-[1.125rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.25rem]">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-[13px] text-[var(--auth-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </header>
  );
}

export function ClienteScopeKpi({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5 sm:py-3.5">
      <p className="text-[11px] font-medium text-[var(--auth-text-soft)]">{label}</p>
      <p className="mt-0.5 truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--auth-text)]">
        {value}
      </p>
    </div>
  );
}
