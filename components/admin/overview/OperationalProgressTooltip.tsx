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
      className={`pointer-events-none absolute z-20 min-w-[6.75rem] rounded-lg border border-white/12 bg-[rgba(12,38,54,0.94)] px-2.5 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-sm ${placementClass}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} aria-hidden />
        <p className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#9dd5e3]">{segment.name}</p>
      </div>
      <p className="mt-0.5 text-sm font-black leading-none text-white">{segment.value}</p>
    </div>
  );
}
