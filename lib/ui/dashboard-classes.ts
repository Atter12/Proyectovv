/** Clases compartidas del panel — misma tipografía/superficie que landing. */
export const dashboardClasses = {
  canvas: "dashboard-canvas min-h-screen",
  page: "min-w-0 space-y-5 sm:space-y-6 lg:space-y-8 dashboard-page-enter",
  statCard:
    "dashboard-kpi min-w-0 rounded-[1.25rem] p-4 transition-all duration-300",
  sectionCard: "dashboard-surface-card overflow-hidden rounded-[1.25rem]",
  tabPanel:
    "dashboard-surface-card rounded-b-[1.25rem] rounded-tr-[1.25rem] border border-t-0 border-[var(--panel-line,rgb(15_23_42_/_0.08))] shadow-[0_12px_32px_rgb(15_23_42_/_0.05)]",
} as const;
