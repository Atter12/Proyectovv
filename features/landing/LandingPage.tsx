import "./nexsas-landing.css";
import { NsNav } from "./NsNav.client";
import { NsHero } from "./NsHero";
import { NsServices } from "./NsServices";
import { NsSteps } from "./NsSteps";
import { NsWhyUs } from "./NsWhyUs";
import { NsResults } from "./NsResults";
import { NsTestimonials } from "./NsTestimonials";
import { NsCta, NsFooter } from "./NsCta";

/**
 * Landing principal — layout NextSaaS / Nexsas demo **digital-marketing**,
 * contenido y marca Holistic. Template reference queda fuera del repo.
 */
export function LandingPage() {
  return (
    <div className="ns-landing relative min-h-screen overflow-x-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Saltar al contenido
      </a>

      <NsNav />
      <main id="contenido">
        <NsHero />
        <NsServices />
        <NsSteps />
        <NsWhyUs />
        <NsResults />
        <NsTestimonials />
        <NsCta />
      </main>
      <NsFooter />
    </div>
  );
}
