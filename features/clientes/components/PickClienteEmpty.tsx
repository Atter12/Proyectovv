import Link from "next/link";
import { routes } from "@/config/routes";

export function PickClienteEmpty({
  section = "esta sección",
}: {
  section?: string;
}) {
  return (
    <div className="dashboard-surface-card flex min-h-[260px] flex-col items-center justify-center rounded-[1.5rem] px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-primary)]/12 text-[var(--brand-primary-deep)] ring-1 ring-[var(--brand-primary)]/20 shadow-[0_0_24px_rgb(255_120_31_/_0.22)]">
        <span className="font-display text-2xl font-medium">CL</span>
      </div>
      <h3 className="font-display text-[1.2rem] font-medium text-[#141210]">
        Primero elegí un cliente
      </h3>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[#6b645c]">
        Para ver {section}, elegí un cliente en <strong>Clientes</strong>. Después
        todo el panel queda filtrado solo a esa persona.
      </p>
      <Link
        href={routes.clientes}
        className="mt-5 inline-flex h-11 items-center rounded-xl bg-[var(--brand-primary)] px-5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgb(255_120_31_/_0.35)] transition-[background-color,transform] hover:bg-[var(--brand-primary-deep)] hover:-translate-y-0.5"
      >
        Ir a Clientes
      </Link>
    </div>
  );
}
