import Link from "next/link";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";

export function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white sm:p-8">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/5" />
      <div className="relative z-10 max-w-2xl">
        <p className="text-sm font-medium text-indigo-100">
          Bienvenido a {siteConfig.name}
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Tu programa publicitario, todo en un solo panel
        </h1>
        <p className="mt-3 text-sm text-indigo-100/90 sm:text-base">
          Gestiona cartera, cuentas publicitarias, pagos y afiliados desde un
          entorno unificado diseñado para escalar campañas.
        </p>
        <Link
          href={routes.adAccounts}
          className="mt-5 inline-flex h-10 items-center rounded-lg bg-white px-5 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
        >
          Crear cuenta publicitaria
        </Link>
      </div>
    </div>
  );
}
