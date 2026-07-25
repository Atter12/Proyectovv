import Link from "next/link";
import { routes } from "@/config/routes";

export function PickClienteEmpty({
  section = "esta sección",
}: {
  section?: string;
}) {
  return (
    <div className="dashboard-surface-card flex min-h-[260px] flex-col items-center justify-center rounded-[1.5rem] px-6 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#178bff]/12 text-[#178bff] ring-1 ring-[#178bff]/20 shadow-[0_0_24px_rgb(23_139_255_/_0.2)]">
        <span className="font-display text-2xl font-medium">CL</span>
      </div>
      <h3 className="font-display text-[1.2rem] font-medium text-[#0b1628]">
        Primero elegí un cliente
      </h3>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[#5b6b82]">
        Para ver {section}, elegí un cliente en <strong>Clientes</strong>. Después
        todo el panel queda filtrado solo a esa persona.
      </p>
      <Link
        href={routes.clientes}
        className="mt-5 inline-flex h-11 items-center rounded-xl bg-[#178bff] px-5 text-[13px] font-semibold text-white shadow-[0_10px_28px_rgb(23_139_255_/_0.32)] transition-[background-color,transform] hover:bg-[#0f7ae5] hover:-translate-y-0.5"
      >
        Ir a Clientes
      </Link>
    </div>
  );
}
