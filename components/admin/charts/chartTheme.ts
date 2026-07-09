export type AdminChartThemeMode = "light" | "dark";

export const lightChartTheme = {
  grid: "#E8EEF5",
  axis: "#94A3B8",
  tooltipBg: "#FFFFFF",
  tooltipBorder: "#E5EAF0",
  text: "#0F172A",
  muted: "#64748B",
  created: "#60A5FA",
  completed: "#22C55E",
  pending: "#D97706",
  processed: "#178BFF",
  empty: "#E5EAF0",
  completedDonut: "#16A34A",
  emittedDonut: "#D97706",
  donutStroke: "#FFFFFF",
  cursorFill: "rgba(23, 139, 255, 0.04)",
  cursorStroke: "rgba(23, 139, 255, 0.06)",
} as const;

export const darkChartTheme = {
  grid: "rgba(148, 163, 184, 0.16)",
  axis: "#718096",
  tooltipBg: "#111821",
  tooltipBorder: "#314158",
  text: "#F8FAFC",
  muted: "#A8B3C5",
  created: "#5BAEFF",
  completed: "#39D98A",
  pending: "#F5B84B",
  processed: "#2997FF",
  empty: "#223044",
  completedDonut: "#39D98A",
  emittedDonut: "#F5B84B",
  donutStroke: "#111821",
  cursorFill: "rgba(41, 151, 255, 0.08)",
  cursorStroke: "rgba(41, 151, 255, 0.12)",
} as const;

export type AdminChartTheme = {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  text: string;
  muted: string;
  created: string;
  completed: string;
  pending: string;
  processed: string;
  empty: string;
  completedDonut: string;
  emittedDonut: string;
  donutStroke: string;
  cursorFill: string;
  cursorStroke: string;
};

export function getAdminChartTheme(mode: AdminChartThemeMode = "light"): AdminChartTheme {
  return mode === "dark" ? darkChartTheme : lightChartTheme;
}

export function readAdminChartThemeMode(): AdminChartThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function getAdminChartSeries(theme: AdminChartTheme) {
  return {
    created: theme.created,
    completed: theme.completed,
    pending: theme.pending,
    processed: theme.processed,
    available: theme.completed,
    reserved: theme.pending,
    payments: theme.processed,
    refunds: theme.pending,
    tickets: theme.created,
    webhooks: theme.pending,
  } as const;
}

export function getAdminChartTooltipStyle(theme: AdminChartTheme) {
  return {
    contentStyle: {
      borderRadius: "12px",
      border: `1px solid ${theme.tooltipBorder}`,
      background: theme.tooltipBg,
      boxShadow: "var(--admin-shadow-3)",
      fontSize: "12px",
      color: theme.text,
      padding: "10px 12px",
    },
    labelStyle: {
      color: theme.muted,
      fontWeight: 500,
      marginBottom: "6px",
      fontSize: "11px",
      letterSpacing: "0.02em",
    },
    itemStyle: {
      color: theme.text,
      fontWeight: 500,
      paddingTop: "2px",
    },
    cursor: { fill: theme.cursorFill, stroke: theme.cursorStroke, strokeWidth: 1 },
  } as const;
}

/** @deprecated Use getAdminChartTheme + getAdminChartSeries */
export const ADMIN_CHART_COLORS = {
  teal: lightChartTheme.processed,
  mint: lightChartTheme.completed,
  amber: lightChartTheme.pending,
  rose: "#DC2626",
  sky: lightChartTheme.created,
  slate: lightChartTheme.muted,
  grid: lightChartTheme.grid,
  axis: lightChartTheme.axis,
} as const;

/** @deprecated Use getAdminChartTheme + getAdminChartSeries */
export const ADMIN_CHART_SERIES = getAdminChartSeries(lightChartTheme);

/** @deprecated Use getAdminChartTooltipStyle */
export const adminChartTooltipStyle = getAdminChartTooltipStyle(lightChartTheme);
