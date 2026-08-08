"use client";

/** Título del cliente en overview — sin BlurText (más pro y más rápido). */
export function OverviewClientTitle({ name }: { name: string }) {
  return (
    <h1 className="mt-2 text-[1.35rem] font-bold leading-[1.2] tracking-[-0.03em] text-[var(--auth-text)] sm:text-[1.85rem]">
      {name}
    </h1>
  );
}
