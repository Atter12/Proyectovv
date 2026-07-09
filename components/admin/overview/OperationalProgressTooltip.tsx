"use client";

type SegmentHover = {
  name: string;
  value: number;
  color: string;
} | null;

type TooltipPlacement = "right" | "left" | "below";

export function OperationalProgressHoverDetail({
  segment,
  placement = "right",
}: {
  segment: SegmentHover;
  placement?: TooltipPlacement;
}) {
  if (!segment || segment.name === "Sin actividad") return null;

  const placementClass =
    placement === "right"
      ? "left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2"
      : placement === "left"
        ? "right-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2"
        : "left-1/2 top-[calc(100%+0.35rem)] -translate-x-1/2";

  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute z-20 min-w-[6.75rem] rounded-lg border border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-2.5 py-1.5 shadow-[var(--admin-shadow-3)] ${placementClass}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden />
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">{segment.name}</p>
      </div>
      <p className="mt-0.5 text-sm font-semibold leading-none text-[var(--admin-text)]">{segment.value}</p>
    </div>
  );
}
