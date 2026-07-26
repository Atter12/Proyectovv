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
    <div className="overflow-hidden rounded-[1.25rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] shadow-[0_12px_32px_rgb(20_18_16_/_0.045)]">
      <div className="relative px-5 py-5 sm:px-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgb(255_120_31_/_0.05),transparent)]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
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
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a5a38]">
                {eyebrow}
              </p>
              <h1 className="mt-1 text-[1.25rem] font-medium tracking-[-0.015em] text-[#1a1612] sm:text-[1.35rem]">
                {title}
              </h1>
              {description ? (
                <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[#6b645c]">
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
  accent = "bg-[#8a8178]",
  tone = "text-[#1a1612]",
}: {
  label: string;
  value: string;
  accent?: string;
  tone?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1rem] border border-[rgb(20_18_16_/_0.08)] bg-[#fffcf8] px-4 py-3.5">
      <span
        aria-hidden
        className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${accent}`}
      />
      <p className="pl-2 text-[11px] font-medium uppercase tracking-[0.1em] text-[#7a736a]">
        {label}
      </p>
      <p
        className={`mt-1 truncate pl-2 text-[1.2rem] font-medium tracking-[-0.015em] tabular-nums ${tone}`}
      >
        {value}
      </p>
    </div>
  );
}
