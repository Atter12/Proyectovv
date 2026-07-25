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

/** Header uniforme Holistic para secciones filtradas por cliente. */
export function ClienteScopePageHeader({
  eyebrow,
  title,
  description,
  name,
  avatarUrl,
  actions,
}: Props) {
  return (
    <div className="dashboard-surface-card rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {name ? (
            <HecomClienteAvatar
              name={name}
              avatarUrl={avatarUrl}
              size="lg"
              className="ring-2 ring-[var(--brand-primary)]/20"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-primary-deep)]">
              {eyebrow}
            </p>
            <h1 className="font-display mt-1 text-2xl font-medium tracking-tight text-[#141210] sm:text-[1.85rem]">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6b645c]">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
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
    <div className="dashboard-kpi rounded-2xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6b645c]">
        {label}
      </p>
      <p className="mt-1 font-display text-[1.35rem] font-medium tracking-[-0.02em] text-[#141210]">
        {value}
      </p>
    </div>
  );
}
