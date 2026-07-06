/** Clases compartidas del panel — mantener consistencia visual premium entre módulos. */
export const dashboardClasses = {
  canvas: "dashboard-canvas min-h-screen dashboard-shell-accent",
  page: "min-w-0 space-y-5 sm:space-y-6 lg:space-y-8 dashboard-page-enter",
  statCard:
    "min-w-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]",
  sectionCard: "overflow-hidden rounded-[1.4rem]",
  tabPanel:
    "rounded-b-[1.4rem] rounded-tr-[1.4rem] border border-t-0 border-[var(--border-subtle)] bg-white/92 shadow-[var(--shadow-card)] backdrop-blur-xl",
} as const;
