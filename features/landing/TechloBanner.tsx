import { routes } from "@/config/routes";
import { TechloButton } from "./TechloButton";
import { TechloProductPanel } from "./TechloProductPanel";

export function TechloBanner() {
  return (
    <section className="tl-hero">
      <div className="tl-container relative z-10 pt-28 pb-14 sm:pt-32 sm:pb-16 lg:pt-36 lg:pb-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div className="max-w-xl">
            <p className="tl-hero-title tl-eyebrow">
              Plataforma para agencias y equipos de performance
            </p>
            <h1 className="tl-hero-title tl-display mt-3 text-[clamp(1.75rem,1.2rem+1.8vw,2.45rem)] leading-[1.2] tracking-[-0.03em]">
              Opera campañas, pagos y saldos en{" "}
              <span className="text-[var(--tl-primary)]">un solo lugar</span>
            </h1>
            <p className="tl-hero-description mt-4 max-w-lg text-[1rem] leading-7 text-[var(--tl-text)] md:text-[1.05rem]">
              Recargá la cartera, asigná presupuesto a cuentas TikTok y
              controlá la operación publicitaria sin planillas ni dashboards
              genéricos.
            </p>
            <div className="tl-hero-actions mt-8 flex flex-wrap items-center gap-3">
              <TechloButton href={routes.login} label="Entrar" />
              <TechloButton
                href="#proceso"
                label="Ver el proceso"
                variant="white"
              />
            </div>

            <div className="tl-hero-actions mt-7 flex items-center gap-3">
              <div
                className="flex shrink-0 -space-x-2"
                aria-hidden
                title="Equipos en Latam"
              >
                {["MG", "RS", "VT", "DP", "CR"].map((initials) => (
                  <span
                    key={initials}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--tl-primary-soft)] text-[10px] font-bold text-[var(--tl-primary)]"
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <p className="min-w-0 text-[0.85rem] font-semibold leading-snug text-[var(--tl-muted)]">
                +180 equipos en Latam ya operan con Holistic
              </p>
            </div>
          </div>

          <div className="tl-hero-actions mx-auto w-full max-w-[520px] lg:max-w-none">
            <TechloProductPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
