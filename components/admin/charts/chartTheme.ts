export const ADMIN_CHART_COLORS = {
  teal: "#0e7490",
  mint: "#59c493",
  amber: "#f4c95d",
  rose: "#e76f8a",
  sky: "#75c7e8",
  slate: "#587080",
  grid: "#dbeaf0",
  axis: "#789bad",
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
    borderRadius: "14px",
    border: "1px solid #cfe8ee",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "0 18px 52px rgba(14,48,72,0.12)",
    fontSize: "12px",
    color: "#061925",
  },
  labelStyle: {
    color: "#23718b",
    fontWeight: 800,
    marginBottom: "4px",
  },
  itemStyle: {
    color: "#061925",
    fontWeight: 700,
  },
} as const;
