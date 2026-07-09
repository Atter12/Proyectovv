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
import { getAdminChartSeries, getAdminChartTheme, getAdminChartTooltipStyle } from "./chartTheme";
import { useAdminChartThemeMode } from "./useAdminChartTheme";

interface PaymentFlowChartProps {
  data: PaymentFlowDayPoint[];
  currency: string;
}

const CHART_HEIGHT_BY_RANGE: Record<PaymentFlowRange, string> = {
  "7D": "11rem",
  "15D": "12rem",
  "30D": "13rem",
};

export function PaymentFlowChart({ data, currency }: PaymentFlowChartProps) {
  const themeMode = useAdminChartThemeMode();
  const chartTheme = useMemo(() => getAdminChartTheme(themeMode), [themeMode]);
  const chartSeries = useMemo(() => getAdminChartSeries(chartTheme), [chartTheme]);
  const tooltipStyle = useMemo(() => getAdminChartTooltipStyle(chartTheme), [chartTheme]);

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
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PaymentFlowSummary totals={totals} currency={currency} />
        <PaymentFlowRangeSelector value={range} suggestedRange={suggestedRange} onChange={setRange} />
      </div>

      {limitedActivity ? (
        <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] px-3 py-2 text-xs font-medium text-[var(--admin-text-muted)]">
          Actividad limitada: se muestran los movimientos disponibles.
        </p>
      ) : null}

      {!hasActivity ? (
        <p className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-soft)]/50 px-3 py-2 text-xs font-medium text-[var(--admin-text-muted)]">
          Sin actividad de pagos en el rango seleccionado.
        </p>
      ) : null}

      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 8, left: -6, bottom: 4 }}>
            <CartesianGrid strokeDasharray="2 6" stroke={chartTheme.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: chartTheme.axis, fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              dy={4}
              minTickGap={range === "7D" ? 12 : 18}
            />
            <YAxis
              yAxisId="count"
              allowDecimals={false}
              tick={{ fill: chartTheme.axis, fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <YAxis
              yAxisId="amount"
              orientation="right"
              tick={{ fill: chartTheme.axis, fontSize: 11, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(value: number) => formatMoney(value * 100, currency).replace(/\s/g, "")}
            />
            <Tooltip
              {...tooltipStyle}
              formatter={(value, name) => {
                const numeric = typeof value === "number" ? value : Number(value ?? 0);
                const label = String(name ?? "");
                if (label === "Monto procesado") return [formatMoney(numeric * 100, currency), label];
                return [numeric, label];
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "12px", fontWeight: 500, color: chartTheme.muted, paddingTop: "14px" }}
            />
            <Bar
              yAxisId="count"
              dataKey="created"
              name="Creados"
              fill={chartSeries.created}
              fillOpacity={0.75}
              radius={[4, 4, 0, 0]}
              maxBarSize={10}
              animationDuration={600}
              animationEasing="ease-out"
            />
            <Bar
              yAxisId="count"
              dataKey="completed"
              name="Completados"
              fill={chartSeries.completed}
              fillOpacity={0.75}
              radius={[4, 4, 0, 0]}
              maxBarSize={10}
              animationDuration={650}
              animationEasing="ease-out"
            />
            <Bar
              yAxisId="count"
              dataKey="pending"
              name="Pendientes"
              fill={chartSeries.pending}
              fillOpacity={0.75}
              radius={[4, 4, 0, 0]}
              maxBarSize={10}
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Line
              yAxisId="amount"
              type="natural"
              dataKey="processedAmount"
              name="Monto procesado"
              stroke={chartSeries.processed}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, fill: chartSeries.processed, stroke: chartTheme.tooltipBg, strokeWidth: 2 }}
              animationDuration={750}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
