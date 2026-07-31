import { AuthDotGridBackground } from "@/features/auth/components/AuthDotGridBackground.client";
import { LandingNav } from "./LandingNav";
import { LandingHero } from "./LandingHero";
import { LandingClients } from "./LandingClients";
import { LandingCore } from "./LandingCore";
import { LandingHow } from "./LandingHow";
import { LandingTools } from "./LandingTools";
import { LandingStats } from "./LandingStats";
import { LandingTestimonials } from "./LandingTestimonials.client";
import { LandingCta } from "./LandingCta";
import { LandingFooter } from "./LandingFooter";

/**
 * Landing completa (estructura tipo Rockads) con estética Holistic actual.
 * Login/register siguen en pantallas dedicadas.
 */
export function LandingPage() {
  return (
    <div className="auth-canvas relative min-h-screen overflow-x-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-[#0f172a]"
      >
        Saltar al contenido
      </a>

      <AuthDotGridBackground tone="light" />

      <div className="relative z-10">
        <LandingNav />
        <main id="contenido">
          <LandingHero />
          <LandingClients />
          <LandingCore />
          <LandingHow />
          <LandingTools />
          <LandingStats />
          <LandingTestimonials />
          <LandingCta />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
