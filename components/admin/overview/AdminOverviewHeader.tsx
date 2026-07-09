import Link from "next/link";
import { adminPanelTypography } from "./adminPanelTypography";

function formatOverviewDate(date: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function AdminOverviewHeader() {
  const todayLabel = formatOverviewDate(new Date());

  return (
    <header className="admin-overview-header mb-4 flex flex-col gap-3 border-b border-[#d9eaf0]/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className={adminPanelTypography.pageTitle}>Resumen administrativo</h1>
        <p className={adminPanelTypography.pageSubtitle}>
          Estado financiero, soporte y operación en tiempo real.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-[#dbeaf0] bg-white/70 px-2.5 py-1 text-xs font-medium capitalize text-[#789bad]">
          {todayLabel}
        </span>
        <Link
          href="/admin/audit"
          className="rounded-md border border-[#cfe8ee] bg-white/80 px-2.5 py-1 text-xs font-semibold text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#f1fff8]"
        >
          Ver auditoría
        </Link>
      </div>
    </header>
  );
}
