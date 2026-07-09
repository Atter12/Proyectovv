export const ADMIN_CHART_COLORS = {
  teal: "#178BFF",
  mint: "#22C55E",
  amber: "#D97706",
  rose: "#DC2626",
  sky: "#60A5FA",
  slate: "#64748B",
  grid: "#E8EEF5",
  axis: "#94A3B8",
} as const;

export const ADMIN_CHART_SERIES = {
  created: ADMIN_CHART_COLORS.sky,
  completed: ADMIN_CHART_COLORS.mint,
  pending: ADMIN_CHART_COLORS.amber,
  processed: ADMIN_CHART_COLORS.teal,
  available: ADMIN_CHART_COLORS.mint,
  reserved: ADMIN_CHART_COLORS.amber,
  payments: ADMIN_CHART_COLORS.teal,
  refunds: ADMIN_CHART_COLORS.amber,
  tickets: ADMIN_CHART_COLORS.sky,
  webhooks: ADMIN_CHART_COLORS.rose,
} as const;

export const adminChartTooltipStyle = {
  contentStyle: {
    borderRadius: "12px",
    border: "1px solid #E5EAF0",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "var(--admin-shadow-2)",
    fontSize: "12px",
    color: "#0F172A",
    padding: "10px 12px",
  },
  labelStyle: {
    color: "#64748B",
    fontWeight: 500,
    marginBottom: "6px",
    fontSize: "11px",
    letterSpacing: "0.02em",
  },
  itemStyle: {
    color: "#0F172A",
    fontWeight: 500,
    paddingTop: "2px",
  },
  cursor: { fill: "rgba(23, 139, 255, 0.04)", stroke: "rgba(23, 139, 255, 0.06)", strokeWidth: 1 },
} as const;
