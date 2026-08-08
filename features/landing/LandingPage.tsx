import "./automation-landing.css";
import { NsxNav } from "./NsxNav.client";
import { NsxHero } from "./NsxHero.client";
import { NsxAbout } from "./NsxAbout";
import { NsxFeatures } from "./NsxFeatures";
import { NsxCta, NsxFooter } from "./NsxCta";

/**
 * Landing principal — layout Automation SaaS (Nexsas template),
 * marca e info Holistic Marketing / Hecom.
 */
export function LandingPage() {
  return (
    <div className="nsx-landing relative min-h-screen overflow-x-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Saltar al contenido
      </a>

      <NsxNav />
      <main id="contenido">
        <NsxHero />
        <NsxAbout />
        <NsxFeatures />
        <NsxCta />
      </main>
      <NsxFooter />
    </div>
  );
}
