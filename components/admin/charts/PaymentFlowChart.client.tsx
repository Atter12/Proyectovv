"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PaymentFlowDayPoint } from "@/lib/admin/data";
import { formatMoney } from "@/lib/format";
import { ADMIN_CHART_SERIES, adminChartTooltipStyle } from "./chartTheme";

interface PaymentFlowChartProps {
  data: PaymentFlowDayPoint[];
  currency: string;
}

function countActiveDays(data: PaymentFlowDayPoint[]): number {
  return data.filter(
    (point) => point.created > 0 || point.completed > 0 || point.pending > 0 || point.processedCents > 0,
  ).length;
}

export function PaymentFlowChart({ data, currency }: PaymentFlowChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    processedAmount: point.processedCents / 100,
  }));
  const activeDays = countActiveDays(chartData);
  const hasActivity = activeDays > 0;
  const limitedActivity = activeDays > 0 && activeDays < 3;

  return (
    <div className="space-y-2">
      {limitedActivity ? (
        <p className="rounded-lg border border-[#dbeaf0] bg-[#f7fcfe] px-3 py-2 text-xs font-semibold text-[#6d8494]">
          Actividad limitada: se muestran los movimientos disponibles.
        </p>
      ) : null}
      {!hasActivity ? (
        <p className="rounded-lg border border-dashed border-[#cfe8ee] bg-white/50 px-3 py-2 text-xs font-semibold text-[#789bad]">
          Sin actividad de pagos en los últimos 30 días. El gráfico refleja el período completo.
        </p>
      ) : null}
      <div className="h-[14rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 6" stroke="#e8f2f6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#789bad", fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              minTickGap={18}
            />
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fill: "#789bad", fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <YAxis
              yAxisId="amount"
              orientation="right"
              tick={{ fill: "#789bad", fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(value: number) => formatMoney(value * 100, currency).replace(/\s/g, "")}
            />
            <Tooltip
              {...adminChartTooltipStyle}
              formatter={(value, name) => {
                const numeric = typeof value === "number" ? value : Number(value ?? 0);
                const label = String(name ?? "");
                if (label === "Monto procesado") return [formatMoney(numeric * 100, currency), label];
                return [numeric, label];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "12px", fontWeight: 700, color: "#587080", paddingTop: "8px" }}
            />
            <Bar yAxisId="count" dataKey="created" name="Creados" fill={ADMIN_CHART_SERIES.created} radius={[6, 6, 0, 0]} maxBarSize={16} />
            <Bar yAxisId="count" dataKey="completed" name="Completados" fill={ADMIN_CHART_SERIES.completed} radius={[6, 6, 0, 0]} maxBarSize={16} />
            <Bar yAxisId="count" dataKey="pending" name="Pendientes" fill={ADMIN_CHART_SERIES.pending} radius={[6, 6, 0, 0]} maxBarSize={16} />
            <Line
              yAxisId="amount"
              type="monotone"
              dataKey="processedAmount"
              name="Monto procesado"
              stroke={ADMIN_CHART_SERIES.processed}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: ADMIN_CHART_SERIES.processed }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
