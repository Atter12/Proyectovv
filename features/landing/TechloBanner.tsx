import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { TechloButton } from "./TechloButton";

export function TechloBanner() {
  return (
    <section className="tl-hero">
      <div className="tl-container relative z-10 pt-32 pb-20 sm:pt-36 sm:pb-24 lg:pt-44 lg:pb-32">
        <div className="mx-auto max-w-4xl text-center">
          <p className="tl-hero-title tl-eyebrow">
            Agencias y equipos de performance en Latam
          </p>
          <h1 className="tl-hero-title tl-display tl-display-lg mt-4">
            {siteConfig.name}: crece con{" "}
            <span className="text-[var(--tl-primary)]">control real</span> en
            ads
          </h1>
          <p className="tl-hero-description mx-auto mt-5 max-w-3xl text-[1.05rem] md:text-lg">
            Cartera Holistic, cuentas TikTok y pagos en un solo panel — claro,
            rápido y sin fricción.
          </p>
          <div className="tl-hero-actions mt-10 flex flex-wrap items-center justify-center gap-4">
            <TechloButton href={routes.login} label="Entrar al panel" />
            <TechloButton
              href="#proceso"
              label="Ver el proceso"
              variant="white"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
