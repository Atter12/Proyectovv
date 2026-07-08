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
    <div className="admin-hero admin-page-hero mb-6 flex flex-col justify-between gap-5 rounded-[1.75rem] border border-[#c8e0e9] p-5 shadow-[var(--shadow-card)] lg:flex-row lg:items-end lg:p-6">
      <div className="min-w-0">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#cfe8ee] bg-white/70 px-3 py-1 text-[0.66rem] font-black uppercase tracking-[0.22em] text-[#0e7490] shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-[#74d3b4]" aria-hidden />
          {eyebrow}
        </div>
        <h1 className="text-3xl font-black tracking-[-0.035em] text-[#061925] sm:text-4xl lg:text-[2.65rem]">{title}</h1>
        {description ? <p className="mt-3 max-w-4xl text-sm leading-7 text-[#587080]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
