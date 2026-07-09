/** Consolidated admin design tokens — CSS variable backed for light/dark */
export const adminTokens = {
  bg: "var(--admin-bg)",
  surface: "var(--admin-surface)",
  surfaceSoft: "var(--admin-surface-soft)",
  border: "var(--admin-border)",
  borderStrong: "var(--admin-border-strong)",
  text: "var(--admin-text)",
  textMuted: "var(--admin-text-muted)",
  textSoft: "var(--admin-text-soft)",
  primary: "var(--admin-accent)",
  primaryHover: "var(--admin-accent-hover)",
  primarySoft: "var(--admin-accent-soft)",
  success: "var(--admin-success)",
  warning: "var(--admin-warning)",
  danger: "var(--admin-danger)",
  info: "var(--admin-info)",
} as const;

/** 4px-based spacing scale for admin content surfaces */
export const adminSpace = {
  card: "p-5",
  cardLg: "p-6",
  cardCompact: "p-4",
  sectionHeader: "mb-4",
  grid: "gap-6",
  stack: "space-y-4",
  stackTight: "space-y-3",
  page: "px-6 py-7 lg:px-8",
} as const;

export const adminRadius = {
  control: "rounded-lg",
  input: "rounded-lg",
  button: "rounded-lg",
  metric: "rounded-xl",
  card: "rounded-xl",
  panel: "rounded-2xl",
  table: "rounded-xl",
  badge: "rounded-md",
} as const;

export const adminColors = {
  bg: "bg-[var(--admin-bg)]",
  card: "bg-[var(--admin-surface)]",
  border: "border-[var(--admin-border)]",
  borderStrong: "border-[var(--admin-border-strong)]",
  text: "text-[var(--admin-text)]",
  textMuted: "text-[var(--admin-text-muted)]",
  textSoft: "text-[var(--admin-text-soft)]",
  primary: "text-[var(--admin-accent)]",
  primaryBg: "bg-[var(--admin-accent-soft)]",
  primaryBorder: "border-[var(--admin-accent-soft)]",
} as const;

export const adminMotion = {
  fast: "transition-[color,background-color,box-shadow,transform,border-color] duration-150 ease-out",
  base: "transition-[box-shadow,transform,border-color] duration-150 ease-out",
  colors: "transition-colors duration-150 ease-out",
} as const;

export const adminShadow = {
  surface: "shadow-[var(--admin-shadow-1)]",
  surfaceHover: "hover:shadow-[var(--admin-shadow-2)]",
  panel: "shadow-[var(--admin-shadow-2)]",
} as const;
