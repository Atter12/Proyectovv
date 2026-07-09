"use client";

import { useMemo, useState } from "react";
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
import {
  countPaymentFlowActiveDays,
  slicePaymentFlowByRange,
  suggestPaymentFlowRange,
  summarizePaymentFlowRange,
  type PaymentFlowRange,
} from "@/lib/admin/chartUtils";
import { formatMoney } from "@/lib/format";
import { PaymentFlowRangeSelector } from "@/components/admin/overview/PaymentFlowRangeSelector";
import { PaymentFlowSummary } from "@/components/admin/overview/PaymentFlowSummary";
import { ADMIN_CHART_COLORS, ADMIN_CHART_SERIES, adminChartTooltipStyle } from "./chartTheme";

interface PaymentFlowChartProps {
  data: PaymentFlowDayPoint[];
  currency: string;
}

const CHART_HEIGHT_BY_RANGE: Record<PaymentFlowRange, string> = {
  "7D": "10rem",
  "15D": "11rem",
  "30D": "12rem",
};

export function PaymentFlowChart({ data, currency }: PaymentFlowChartProps) {
  const suggestedRange = useMemo(() => suggestPaymentFlowRange(data), [data]);
  const [range, setRange] = useState<PaymentFlowRange>(() => suggestPaymentFlowRange(data));

  const rangedData = useMemo(() => slicePaymentFlowByRange(data, range), [data, range]);
  const totals = useMemo(() => summarizePaymentFlowRange(rangedData), [rangedData]);
  const chartData = useMemo(
    () =>
      rangedData.map((point) => ({
        ...point,
        processedAmount: point.processedCents / 100,
      })),
    [rangedData],
  );

  const activeDays = countPaymentFlowActiveDays(rangedData);
  const hasActivity = activeDays > 0;
  const limitedActivity = activeDays > 0 && activeDays < 3;
  const chartHeight = limitedActivity ? "10rem" : CHART_HEIGHT_BY_RANGE[range];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PaymentFlowSummary totals={totals} currency={currency} />
        <PaymentFlowRangeSelector value={range} suggestedRange={suggestedRange} onChange={setRange} />
      </div>

      {limitedActivity ? (
        <p className="rounded-lg border border-[#dbeaf0] bg-[#f7fcfe] px-3 py-2 text-xs font-semibold text-[#6d8494]">
          Actividad limitada: se muestran los movimientos disponibles.
        </p>
      ) : null}

      {!hasActivity ? (
        <p className="rounded-lg border border-dashed border-[#cfe8ee] bg-white/50 px-3 py-2 text-xs font-semibold text-[#789bad]">
          Sin actividad de pagos en el rango seleccionado.
        </p>
      ) : null}

      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 4" stroke={ADMIN_CHART_COLORS.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: ADMIN_CHART_COLORS.axis, fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              minTickGap={range === "7D" ? 12 : 18}
            />
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fill: ADMIN_CHART_COLORS.axis, fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <YAxis
              yAxisId="amount"
              orientation="right"
              tick={{ fill: ADMIN_CHART_COLORS.axis, fontSize: 11, fontWeight: 500 }}
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
            <Legend wrapperStyle={{ fontSize: "12px", fontWeight: 600, color: "#6d8494", paddingTop: "8px" }} />
            <Bar
              yAxisId="count"
              dataKey="created"
              name="Creados"
              fill={ADMIN_CHART_SERIES.created}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              animationDuration={500}
              animationEasing="ease-out"
            />
            <Bar
              yAxisId="count"
              dataKey="completed"
              name="Completados"
              fill={ADMIN_CHART_SERIES.completed}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              animationDuration={550}
              animationEasing="ease-out"
            />
            <Bar
              yAxisId="count"
              dataKey="pending"
              name="Pendientes"
              fill={ADMIN_CHART_SERIES.pending}
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              animationDuration={600}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="amount"
              type="monotone"
              dataKey="processedAmount"
              name="Monto procesado"
              stroke={ADMIN_CHART_SERIES.processed}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: ADMIN_CHART_SERIES.processed, stroke: "#fff", strokeWidth: 2 }}
              animationDuration={650}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
