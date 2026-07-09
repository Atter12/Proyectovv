export const ADMIN_CHART_COLORS = {
  teal: "#3d8fa8",
  mint: "#5aab8a",
  amber: "#c9a24e",
  rose: "#c96a82",
  sky: "#6eb0c8",
  slate: "#6d8494",
  grid: "#f0f5f7",
  axis: "#8fa3b0",
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
    borderRadius: "10px",
    border: "1px solid rgb(14 72 90 / 0.08)",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "var(--admin-shadow-3)",
    fontSize: "12px",
    color: "#061925",
    padding: "10px 12px",
  },
  labelStyle: {
    color: "#5d7280",
    fontWeight: 600,
    marginBottom: "6px",
    fontSize: "11px",
  },
  itemStyle: {
    color: "#061925",
    fontWeight: 500,
    paddingTop: "2px",
  },
  cursor: { fill: "rgba(14, 116, 144, 0.04)" },
} as const;
