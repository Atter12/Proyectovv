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
    <div className="admin-hero mb-6 flex flex-col justify-between gap-4 rounded-[1.6rem] border border-[#cfe1e9] p-5 shadow-[var(--shadow-card)] lg:flex-row lg:items-end lg:p-6">
      <div>
        <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-[#0e7490]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#061925] sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d7280]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
