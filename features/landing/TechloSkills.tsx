import { routes } from "@/config/routes";
import { TechloButton } from "./TechloButton";

const FEATURES = [
  {
    title: "Cartera y asignación",
    description: "Recargá, asigná a TikTok y seguí cada movimiento.",
  },
  {
    title: "Soporte Latam",
    description: "Atención en español alineada a cómo operan las agencias.",
  },
] as const;

export function TechloSkills() {
  return (
    <section
      id="herramientas"
      className="tl-section bg-[var(--tl-theme-light)]"
    >
      <div className="tl-container grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div
          className="relative mx-auto w-full max-w-lg"
          data-scroll-reveal="image-clip"
        >
          <div className="relative overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/techlo/skill/skill-1.png"
              alt=""
              className="h-auto w-full object-cover"
            />
          </div>
          <div className="absolute -right-2 -bottom-8 w-[55%] overflow-hidden rounded-xl border-4 border-white shadow-xl sm:-right-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/techlo/skill/skill-2.jpg"
              alt=""
              className="h-auto w-full object-cover"
            />
          </div>
        </div>

        <div data-scroll-reveal="blur-up" data-scroll-reveal-delay="80">
          <h2 className="tl-display tl-display-md">
            Tecnología que organiza la operación publicitaria
          </h2>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-[1.8]">
            Planificá pagos, cuentas y creativos en un panel formal — menos
            fricción, más trazabilidad financiera real.
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-[var(--tl-border)] bg-white p-5"
                data-scroll-reveal="zoom-in"
              >
                <p className="tl-h3 text-[1.05rem]">{item.title}</p>
                <p className="mt-2 text-[0.95rem] leading-7">{item.description}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <TechloButton href={routes.login} label="Entrar al panel" />
          </div>
        </div>
      </div>
    </section>
  );
}
