import { siteConfig } from "@/config/site";

export function AffiliateHero() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500 p-6 text-white sm:p-8">
      <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/10 to-transparent" />
      <div className="relative z-10">
        <h1 className="text-2xl font-bold sm:text-3xl">
          Programa de afiliados de {siteConfig.companyName}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">
          Comparte tu enlace, invita anunciantes y gana comisiones por el gasto
          publicitario de tus referidos.
        </p>
      </div>
    </div>
  );
}
