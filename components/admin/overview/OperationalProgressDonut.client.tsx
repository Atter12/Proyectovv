"use client";

import { useEffect, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { OperationalProgressHoverDetail } from "@/components/admin/overview/OperationalProgressTooltip";
import type { OperationalMonthlyProgress } from "@/lib/admin/data";

export type OperationalProgressDonutProps = OperationalMonthlyProgress;

const COLORS = {
  completed: "#16A34A",
  emitted: "#D97706",
  empty: "#E5EAF0",
} as const;

type ChartSegment = {
  name: string;
  value: number;
  color: string;
};

type TooltipPlacement = "right" | "left" | "below";

function resolveTooltipPlacement(container: HTMLDivElement | null): TooltipPlacement {
  if (!container || typeof window === "undefined") return "left";

  const rect = container.getBoundingClientRect();
  const spaceRight = window.innerWidth - rect.right;
  const spaceLeft = rect.left;

  if (spaceLeft >= 110) return "left";
  if (spaceRight >= 110) return "right";
  return "below";
}

export function OperationalProgressDonut({
  total,
  emitted,
  completed,
  completionRate,
  integrated = false,
}: OperationalProgressDonutProps & { integrated?: boolean }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<ChartSegment | null>(null);
  const [tooltipPlacement, setTooltipPlacement] = useState<TooltipPlacement>("right");

  const chartData: ChartSegment[] =
    total === 0
      ? [{ name: "Sin actividad", value: 1, color: COLORS.empty }]
      : [
          ...(completed > 0 ? [{ name: "Cumplidas", value: completed, color: COLORS.completed }] : []),
          ...(emitted > 0 ? [{ name: "Emitidas", value: emitted, color: COLORS.emitted }] : []),
        ];

  const safeData = chartData.length > 0 ? chartData : [{ name: "Sin actividad", value: 1, color: COLORS.empty }];

  useEffect(() => {
    if (!hoveredSegment) return;

    const updatePlacement = () => {
      setTooltipPlacement(resolveTooltipPlacement(chartRef.current));
    };

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    return () => window.removeEventListener("resize", updatePlacement);
  }, [hoveredSegment]);

  const handleSegmentEnter = (segment: ChartSegment) => {
    if (total === 0 || segment.name === "Sin actividad") return;
    setTooltipPlacement(resolveTooltipPlacement(chartRef.current));
    setHoveredSegment(segment);
  };

  const chartSizeClass = integrated
    ? "h-[7.75rem] w-[7.75rem] sm:h-[8.25rem] sm:w-[8.25rem]"
    : "h-[5.5rem] w-[5.5rem] sm:h-[6.5rem] sm:w-[6.5rem]";

  return (
    <div className="flex min-w-0 shrink-0 flex-col items-center justify-center">
      <div ref={chartRef} className={`relative overflow-visible ${chartSizeClass}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              stroke="#ffffff"
              strokeWidth={2}
              paddingAngle={total > 0 && emitted > 0 && completed > 0 ? 3 : 0}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
              onMouseLeave={() => setHoveredSegment(null)}
            >
              {safeData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  className={total > 0 && entry.name !== "Sin actividad" ? "cursor-pointer" : undefined}
                  onMouseEnter={() => handleSegmentEnter(entry)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-semibold leading-none tracking-tight text-slate-950 sm:text-[1.3rem]">
            {total > 0 ? `${completionRate}%` : "0"}
          </span>
          <span className="mt-0.5 text-[0.6rem] font-medium uppercase tracking-[0.06em] text-slate-400">
            {total > 0 ? "cumplido" : "sin actividad"}
          </span>
        </div>

        {total > 0 ? <OperationalProgressHoverDetail segment={hoveredSegment} placement={tooltipPlacement} /> : null}
      </div>

      <div className="mt-2 max-w-[9rem] text-center">
        <p className="text-[0.625rem] font-medium uppercase tracking-[0.07em] text-slate-500">
          {total > 0 ? "Solicitudes del mes" : "Sin actividad este mes"}
        </p>
        {total > 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            {completed} cumplidas · {emitted} emitidas
          </p>
        ) : null}
      </div>
    </div>
  );
}
