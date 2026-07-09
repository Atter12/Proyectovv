import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
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
    <header className="admin-overview-header mb-6 flex flex-col gap-4 border-b border-[var(--admin-border)]/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className={adminPanelTypography.pageTitle}>Resumen administrativo</h1>
        <p className={adminPanelTypography.pageSubtitle}>
          Estado financiero, soporte y operación en tiempo real.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral" className="h-8 px-2.5 capitalize">
          {todayLabel}
        </Badge>
        <Link href="/admin/audit" className={buttonClass("outline", "sm")}>
          Ver auditoría
        </Link>
      </div>
    </header>
  );
}
