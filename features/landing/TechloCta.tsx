import { routes } from "@/config/routes";
import { TechloButton } from "./TechloButton";

export function TechloCta() {
  return (
    <section className="tl-cta tl-section py-20 md:py-24 xl:py-28">
      <div
        className="tl-container relative z-10 mx-auto max-w-4xl"
        data-scroll-reveal="blur-up"
      >
        <h2 className="tl-display tl-display-md text-white">
          Empezá hoy con Holistic
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-[1.05rem] leading-[1.8] text-[var(--tl-light)]">
          Entrá con tu email, elegí el cliente y operá cartera, cuentas TikTok y
          pagos en un solo lugar.
        </p>
        <div className="mt-8">
          <TechloButton href={routes.login} label="Entrar al panel" />
        </div>
      </div>
    </section>
  );
}
