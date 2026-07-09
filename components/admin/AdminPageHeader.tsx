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
    <div className="admin-hero admin-page-hero mb-6 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--admin-shadow-1)] lg:flex-row lg:items-end lg:p-6">
      <div className="min-w-0">
        <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-[#EAF4FF] px-2.5 py-1 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[#178BFF]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#178BFF]" aria-hidden />
          {eyebrow}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-4xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
