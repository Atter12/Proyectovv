"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { OperationalMonthlyProgress } from "@/lib/admin/data";

export type OperationalProgressDonutProps = OperationalMonthlyProgress;

const COLORS = {
  completed: "#6ee7b7",
  emitted: "#fbbf24",
  empty: "rgba(255,255,255,0.12)",
} as const;

export function OperationalProgressDonut({
  total,
  emitted,
  completed,
  completionRate,
}: OperationalProgressDonutProps) {
  const chartData =
    total === 0
      ? [{ name: "Sin actividad", value: 1, color: COLORS.empty }]
      : [
          ...(completed > 0 ? [{ name: "Cumplidas", value: completed, color: COLORS.completed }] : []),
          ...(emitted > 0 ? [{ name: "Emitidas", value: emitted, color: COLORS.emitted }] : []),
        ];

  const safeData = chartData.length > 0 ? chartData : [{ name: "Sin actividad", value: 1, color: COLORS.empty }];

  return (
    <div className="flex shrink-0 flex-col items-center justify-center">
      <div className="relative h-[5.5rem] w-[5.5rem] sm:h-[6.5rem] sm:w-[6.5rem]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={safeData}
              dataKey="value"
              nameKey="name"
              innerRadius="68%"
              outerRadius="100%"
              stroke="none"
              paddingAngle={total > 0 && emitted > 0 && completed > 0 ? 2 : 0}
              isAnimationActive={false}
            >
              {safeData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            {total > 0 ? (
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(16,47,66,0.96)",
                  fontSize: "11px",
                  color: "#e8f4f8",
                }}
                itemStyle={{ color: "#e8f4f8", fontWeight: 700 }}
                labelStyle={{ color: "#9dd5e3", fontWeight: 800 }}
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-black leading-none text-white sm:text-xl">
            {total > 0 ? `${completionRate}%` : "0"}
          </span>
          <span className="mt-0.5 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#9dd5e3]">
            {total > 0 ? "cumplido" : "sin actividad"}
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-center">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#9dd5e3]">
          {total > 0 ? "Solicitudes del mes" : "Sin actividad este mes"}
        </p>
        {total > 0 ? (
          <p className="mt-0.5 text-[0.68rem] font-semibold text-[#b8d2df]">
            {completed} cumplidas · {emitted} emitidas
          </p>
        ) : null}
      </div>
    </div>
  );
}
