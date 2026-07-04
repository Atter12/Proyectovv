/** Clases compartidas del panel — mantener consistencia visual entre módulos. */
export const dashboardClasses = {
  canvas: "dashboard-canvas min-h-screen",
  page: "min-w-0 space-y-5 sm:space-y-6 lg:space-y-8",
  statCard:
    "min-w-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
  sectionCard: "overflow-hidden",
  tabPanel: "rounded-b-2xl rounded-tr-2xl border border-t-0 border-[var(--border-subtle)] bg-white shadow-[var(--shadow-card)]",
} as const;
