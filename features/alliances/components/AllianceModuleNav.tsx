import Link from "next/link";

const LINKS = [
  { key: "resumen", label: "Resumen", suffix: "" },
  { key: "contratos", label: "Contratos", suffix: "/contratos" },
  { key: "calendario", label: "Calendario", suffix: "/calendario" },
  { key: "plantillas", label: "Plantillas", suffix: "/plantillas" },
] as const;

export function AllianceModuleNav({ basePath, current }: { basePath: string; current: (typeof LINKS)[number]["key"] }) {
  return (
    <nav className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-1" aria-label="Secciones de alianzas">
      {LINKS.map((link) => {
        const selected = link.key === current;
        return (
          <Link
            key={link.key}
            href={`${basePath}${link.suffix}`}
            className={
              selected
                ? "rounded-lg bg-[var(--admin-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--admin-text)] shadow-[var(--admin-shadow-1)]"
                : "rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)]"
            }
            aria-current={selected ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
