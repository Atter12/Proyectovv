import Link from "next/link";
import { routes } from "@/config/routes";

export function PickClienteEmpty({
  section = "esta sección",
}: {
  section?: string;
}) {
  return (
    <div className="dashboard-surface-card flex min-h-[260px] flex-col items-center justify-center rounded-[1.25rem] px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--auth-accent-soft)] text-[var(--auth-accent)] ring-1 ring-[var(--auth-accent)]/20 shadow-[0_8px_20px_rgb(255_120_31_/_0.2)]">
        <span className="text-2xl font-bold tracking-[-0.03em]">CL</span>
      </div>
      <h3 className="text-[1.45rem] font-bold leading-[1.15] tracking-[-0.03em] text-[var(--auth-text)]">
        Primero elegí un cliente
      </h3>
      <p className="mt-2 max-w-md text-[15px] font-medium leading-6 text-[var(--auth-text-muted)]">
        Para ver {section}, elegí un cliente en <strong>Clientes</strong>. Después
        todo el panel queda filtrado solo a esa persona.
      </p>
      <Link
        href={routes.clientes}
        className="mt-5 inline-flex h-12 items-center rounded-xl bg-[var(--auth-accent)] px-5 text-[15px] font-bold text-white shadow-[0_10px_24px_rgb(255_120_31_/_0.28)] transition-[filter,transform] hover:brightness-[1.05] active:translate-y-px"
      >
        Ir a Clientes
      </Link>
    </div>
  );
}
