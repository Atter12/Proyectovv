import Link from "next/link";

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
        <h1 className="text-xl font-black tracking-tight text-[#061925] sm:text-[1.35rem]">Resumen administrativo</h1>
        <p className="mt-0.5 text-sm font-semibold text-[#587080]">Estado financiero, soporte y operación en tiempo real.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-[#dbeaf0] bg-white/70 px-2.5 py-1 text-xs font-bold capitalize text-[#789bad]">
          {todayLabel}
        </span>
        <Link
          href="/admin/audit"
          className="rounded-md border border-[#cfe8ee] bg-white/80 px-2.5 py-1 text-xs font-black text-[#0e7490] transition hover:border-[#74d3b4] hover:bg-[#f1fff8]"
        >
          Ver auditoría
        </Link>
      </div>
    </header>
  );
}
