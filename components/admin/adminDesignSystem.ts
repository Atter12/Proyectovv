/** 4px-based spacing scale for admin content surfaces */
export const adminSpace = {
  card: "p-5",
  cardCompact: "p-4",
  sectionHeader: "mb-4",
  grid: "gap-5",
  stack: "space-y-4",
} as const;

/** Radius hierarchy: controls < buttons < metrics < cards < panels */
export const adminRadius = {
  control: "rounded-md",
  button: "rounded-lg",
  metric: "rounded-xl",
  card: "rounded-2xl",
  table: "rounded-xl",
  badge: "rounded-md",
} as const;

export const adminMotion = {
  fast: "transition-[color,background-color,box-shadow,transform,border-color] duration-150 ease-out",
  base: "transition-[color,background-color,box-shadow,transform,border-color] duration-[180ms] ease-out",
} as const;

export const adminShadow = {
  surface: "shadow-[var(--admin-shadow-2)]",
  surfaceHover: "hover:shadow-[var(--admin-shadow-3)]",
  inset: "shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]",
} as const;
