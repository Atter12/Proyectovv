/** 4px-based spacing scale for admin content surfaces */
export const adminSpace = {
  card: "p-5",
  cardCompact: "p-4",
  sectionHeader: "mb-4",
  grid: "gap-5",
  stack: "space-y-4",
  stackTight: "space-y-3",
} as const;

/** Radius hierarchy: controls ≈10px → inputs ≈12px → cards ≈18px → panels ≈22px */
export const adminRadius = {
  control: "rounded-[10px]",
  input: "rounded-xl",
  button: "rounded-[10px]",
  metric: "rounded-[14px]",
  card: "rounded-[18px]",
  panel: "rounded-[22px]",
  table: "rounded-xl",
  badge: "rounded-[6px]",
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
