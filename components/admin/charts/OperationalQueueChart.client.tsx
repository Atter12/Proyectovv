"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { OperationalQueuePoint } from "@/lib/admin/data";
import { ADMIN_CHART_SERIES, adminChartTooltipStyle } from "./chartTheme";

interface OperationalQueueChartProps {
  data: OperationalQueuePoint[];
}

const categoryColors: Record<string, string> = {
  payments: ADMIN_CHART_SERIES.payments,
  refunds: ADMIN_CHART_SERIES.refunds,
  tickets: ADMIN_CHART_SERIES.tickets,
  webhooks: ADMIN_CHART_SERIES.webhooks,
};

export function OperationalQueueChart({ data }: OperationalQueueChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-4">
      <div className="h-[14rem] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 6" stroke="#e8f2f6" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "#789bad", fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={118}
              tick={{ fill: "#365c6d", fontSize: 11, fontWeight: 800 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip {...adminChartTooltipStyle} />
            <Bar dataKey="count" name="Pendientes" radius={[0, 8, 8, 0]} maxBarSize={22}>
              {data.map((item) => (
                <Cell key={item.category} fill={categoryColors[item.category] ?? ADMIN_CHART_SERIES.payments} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.map((item) => (
          <Link
            key={item.category}
            href={item.href}
            className="rounded-xl border border-[#dbeaf0] bg-white/70 px-3 py-2 text-xs font-bold text-[#365c6d] transition hover:border-[#74d3b4] hover:bg-[#f1fff8]"
          >
            <span className="block text-[#789bad]">{item.label}</span>
            <span className="mt-1 block text-lg font-black text-[#061925]">{item.count}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs font-bold text-[#789bad]">
        {total > 0 ? `${total} asuntos activos en cola operativa.` : "Cola operativa al día."}
      </p>
    </div>
  );
}
