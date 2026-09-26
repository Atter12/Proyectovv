import Link from "next/link";

const LINKS = [
  { key: "resumen", label: "Resumen", suffix: "" },
  { key: "contratos", label: "Contratos", suffix: "/contratos" },
  { key: "calendario", label: "Calendario", suffix: "/calendario" },
  { key: "plantillas", label: "Plantillas", suffix: "/plantillas" },
] as const;

export function AllianceModuleNav({ basePath, current }: { basePath: string; current: (typeof LINKS)[number]["key"] }) {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Secciones de alianzas">
      {LINKS.map((link) => (
        <Link
          key={link.key}
          href={`${basePath}${link.suffix}`}
          className={
            link.key === current
              ? "text-sm font-semibold text-[var(--admin-text)]"
              : "text-sm font-semibold text-[var(--admin-accent)] hover:text-[var(--admin-accent-hover)]"
          }
          aria-current={link.key === current ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
