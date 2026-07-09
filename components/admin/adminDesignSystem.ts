/** Consolidated admin design tokens — Rockads-inspired light SaaS */
export const adminTokens = {
  bg: "#F6F8FB",
  surface: "#FFFFFF",
  surfaceSoft: "#F9FBFD",
  border: "#E5EAF0",
  borderStrong: "#D7DEE8",
  text: "#0F172A",
  textMuted: "#64748B",
  textSoft: "#94A3B8",
  primary: "#178BFF",
  primaryHover: "#0F7AE5",
  primarySoft: "#EAF4FF",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#178BFF",
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
  bg: "bg-[#F6F8FB]",
  card: "bg-white",
  border: "border-slate-200",
  borderStrong: "border-slate-300",
  text: "text-slate-950",
  textMuted: "text-slate-500",
  textSoft: "text-slate-400",
  primary: "text-[#178BFF]",
  primaryBg: "bg-[#EAF4FF]",
  primaryBorder: "border-blue-100",
} as const;

export const adminMotion = {
  fast: "transition-[color,background-color,box-shadow,transform,border-color] duration-150 ease-out",
  base: "transition-[box-shadow,transform,border-color] duration-150 ease-out",
  colors: "transition-colors duration-150 ease-out",
} as const;

export const adminShadow = {
  surface: "shadow-sm",
  surfaceHover: "hover:shadow-md",
  panel: "shadow-[var(--admin-shadow-2)]",
} as const;
