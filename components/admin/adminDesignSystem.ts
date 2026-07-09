/** 4px-based spacing scale for admin content surfaces */
export const adminSpace = {
  card: "p-5",
  cardCompact: "p-4",
  sectionHeader: "mb-4",
  grid: "gap-5",
  stack: "space-y-4",
  stackTight: "space-y-3",
  page: "px-4 py-6 sm:px-6 lg:px-8 xl:py-7",
} as const;

/** Radius hierarchy aligned with Rockads-style SaaS surfaces */
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

/** Semantic color tokens (Tailwind classes referencing CSS variables) */
export const adminColors = {
  bg: "bg-[var(--admin-bg)]",
  card: "bg-white",
  border: "border-[var(--admin-border)]",
  text: "text-[var(--admin-text)]",
  textMuted: "text-[var(--admin-text-muted)]",
  primary: "text-[var(--admin-accent)]",
  primaryBg: "bg-[var(--admin-primary-soft)]",
  primaryBorder: "border-[var(--admin-accent)]/20",
} as const;

export const adminMotion = {
  fast: "transition-[color,background-color,box-shadow,transform,border-color,opacity] duration-150 ease-out",
  base: "transition-[color,background-color,box-shadow,transform,border-color,opacity] duration-[180ms] ease-out",
} as const;

export const adminShadow = {
  surface: "shadow-[var(--admin-shadow-2)]",
  surfaceHover: "hover:shadow-[var(--admin-shadow-3)]",
  panel: "shadow-[var(--admin-shadow-3)]",
  inset: "shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]",
} as const;
