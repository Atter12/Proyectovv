/** Clases compartidas del panel — Holistic fintech (login → panel). */
export const dashboardClasses = {
  canvas: "dashboard-canvas min-h-screen dashboard-shell-accent",
  page: "min-w-0 space-y-5 sm:space-y-6 lg:space-y-8 dashboard-page-enter",
  statCard:
    "dashboard-kpi min-w-0 rounded-2xl p-4 transition-all duration-300",
  sectionCard: "dashboard-surface-card overflow-hidden rounded-[1.35rem]",
  tabPanel:
    "dashboard-surface-card rounded-b-[1.35rem] rounded-tr-[1.35rem] border border-t-0 border-[var(--panel-line,var(--border-subtle))] shadow-[0_14px_36px_rgb(20_18_16_/_0.06)] backdrop-blur-xl",
} as const;
