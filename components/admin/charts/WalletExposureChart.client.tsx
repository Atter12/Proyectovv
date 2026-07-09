"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WalletExposurePoint } from "@/lib/admin/data";
import { formatMoney } from "@/lib/format";
import { ADMIN_CHART_SERIES, adminChartTooltipStyle } from "./chartTheme";

interface WalletExposureChartProps {
  data: WalletExposurePoint[];
  currency: string;
}

function truncateLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function WalletExposureChart({ data, currency }: WalletExposureChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[16rem] items-center justify-center rounded-2xl border border-dashed border-[#cfe8ee] bg-white/50 text-sm font-bold text-[#789bad]">
        No hay wallets activas con saldo registrado.
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    shortName: truncateLabel(item.organizationName),
    availableAmount: item.availableCents / 100,
    reservedAmount: item.reservedCents / 100,
  }));

  return (
    <div className="h-[16rem] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 6" stroke="#e8f2f6" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#789bad", fontSize: 11, fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatMoney(value * 100, currency).replace(/\s/g, "")}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={108}
            tick={{ fill: "#365c6d", fontSize: 11, fontWeight: 800 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            {...adminChartTooltipStyle}
            formatter={(value, name) => {
              const numeric = typeof value === "number" ? value : Number(value ?? 0);
              return [formatMoney(numeric * 100, currency), String(name ?? "")];
            }}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload as WalletExposurePoint & { shortName: string } | undefined;
              return point?.organizationName ?? "";
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", fontWeight: 700, color: "#587080", paddingTop: "8px" }} />
          <Bar dataKey="availableAmount" name="Disponible" stackId="wallet" fill={ADMIN_CHART_SERIES.available} radius={[0, 0, 0, 0]} maxBarSize={18} />
          <Bar dataKey="reservedAmount" name="Reservado" stackId="wallet" fill={ADMIN_CHART_SERIES.reserved} radius={[0, 8, 8, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
