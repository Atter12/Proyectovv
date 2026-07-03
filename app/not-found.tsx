import Link from "next/link";
import { routes } from "@/config/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7fb] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#4056ff]">404</p>
        <h1 className="mt-2 text-lg font-semibold text-[#0f172a]">
          Página no encontrada
        </h1>
        <p className="mt-2 text-sm text-[#64748b]">
          La ruta que buscas no existe o fue movida.
        </p>
        <Link
          href={routes.login}
          className="mt-6 inline-flex h-10 items-center rounded-xl bg-[#4056ff] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#4056ff]/90"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
