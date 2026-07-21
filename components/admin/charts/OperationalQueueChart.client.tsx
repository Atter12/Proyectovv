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
            <CartesianGrid strokeDasharray="4 6" stroke="var(--admin-border)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--admin-text-muted)", fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              width={118}
              tick={{ fill: "var(--admin-text)", fontSize: 11, fontWeight: 800 }}
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
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]/70 px-3 py-2 text-xs font-bold text-[var(--admin-text-muted)] transition hover:border-[var(--admin-accent)] hover:bg-[var(--admin-accent-soft)]"
          >
            <span className="block text-[var(--admin-text-muted)]">{item.label}</span>
            <span className="mt-1 block text-lg font-semibold text-[var(--admin-text)]">{item.count}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs font-bold text-[var(--admin-text-muted)]">
        {total > 0 ? `${total} asuntos activos en cola operativa.` : "Cola operativa al día."}
      </p>
    </div>
  );
}
