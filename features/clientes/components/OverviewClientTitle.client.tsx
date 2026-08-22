"use client";

/** Título del cliente en overview — jerarquía operativa, no landing. */
export function OverviewClientTitle({ name }: { name: string }) {
  return (
    <h1 className="mt-1 text-[1.125rem] font-bold leading-snug tracking-[-0.02em] text-[var(--auth-text)] sm:text-[1.25rem]">
      {name}
    </h1>
  );
}
