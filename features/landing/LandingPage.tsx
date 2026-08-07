import "./techlo-landing.css";
import { TechloMotionRoot } from "./TechloMotionRoot.client";
import { TechloNav } from "./TechloNav";
import { TechloBanner } from "./TechloBanner";
import { TechloServices } from "./TechloServices";
import { TechloSkills } from "./TechloSkills";
import { TechloProcess } from "./TechloProcess";
import { TechloQuotes } from "./TechloQuotes.client";
import { TechloCta } from "./TechloCta";
import { TechloFooter } from "./TechloFooter";

/**
 * Landing principal — estructura/animaciones de Techlo Lite,
 * colores Holistic (#ff781f) + tipografía Sora + copy Holistic.
 */
export function LandingPage() {
  return (
    <div className="techlo-landing relative min-h-screen overflow-x-hidden">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm"
      >
        Saltar al contenido
      </a>

      <TechloMotionRoot>
        <TechloNav />
        <main id="contenido">
          <TechloBanner />
          <TechloServices />
          <TechloSkills />
          <TechloProcess />
          <TechloQuotes />
          <TechloCta />
        </main>
        <TechloFooter />
      </TechloMotionRoot>
    </div>
  );
}
