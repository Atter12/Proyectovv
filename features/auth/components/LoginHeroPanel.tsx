import { AuthProductHeroPanel } from "@/features/auth/components/AuthProductHeroPanel";

/** Panel derecho login — mismo mockup dashboard. */
export function LoginHeroPanel() {
  return (
    <AuthProductHeroPanel
      subtitle="Entrá con tu correo: cartera, cuentas TikTok y rendimiento en un solo lugar."
    />
  );
}

/** Intro compacta solo móvil/tablet. */
export function LoginMobileIntro() {
  return (
    <div className="relative mb-5 overflow-hidden rounded-[1.25rem] bg-[#12141a] px-5 py-4 text-white lg:hidden">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--auth-accent)]">
        Ads Holistic
      </p>
      <p className="mt-1.5 text-[1.05rem] font-bold leading-snug tracking-[-0.02em]">
        TikTok Ads con control y resultados claros
      </p>
    </div>
  );
}
