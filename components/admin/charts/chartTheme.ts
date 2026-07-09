export const ADMIN_CHART_COLORS = {
  teal: "#4a8fa3",
  mint: "#5a9e7f",
  amber: "#b89547",
  rose: "#b86a7f",
  sky: "#6aadc4",
  slate: "#6d8494",
  grid: "#f5f8fa",
  axis: "#94a8b4",
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
    border: "none",
    background: "rgba(255,255,255,0.98)",
    boxShadow: "var(--admin-shadow-4)",
    fontSize: "12px",
    color: "#061925",
    padding: "12px 14px",
  },
  labelStyle: {
    color: "#6d8494",
    fontWeight: 500,
    marginBottom: "8px",
    fontSize: "11px",
    letterSpacing: "0.02em",
  },
  itemStyle: {
    color: "#061925",
    fontWeight: 500,
    paddingTop: "3px",
  },
  cursor: { fill: "rgba(14, 116, 144, 0.03)", stroke: "rgba(14, 116, 144, 0.06)", strokeWidth: 1 },
} as const;
