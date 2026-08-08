import Link from "next/link";
import { routes } from "@/config/routes";
import { NsReveal } from "./NsReveal.client";

const results = [
  {
    label: "Equipos",
    value: "+180",
    description: "Equipos de performance y agencias en Latam.",
  },
  {
    label: "Visibilidad",
    value: "Hoy / 7d",
    description: "Gasto diario y ventana semanal en el overview.",
  },
  {
    label: "Sincronía",
    value: "TikTok",
    description: "Snapshots de spend listos para cliente y gerente.",
  },
  {
    label: "Roles",
    value: "2+1",
    description: "Cliente, gerente y super admin en un flujo unificado.",
  },
  {
    label: "Fondeo",
    value: "Stripe + BM",
    description: "Recarga del cliente y trasferencia BC de agencia.",
  },
] as const;

export function NsResults() {
  const loop = [...results, ...results];

  return (
    <section
      id="resultados"
      className="ns-section relative bg-[var(--ns-bg-2)]"
    >
      <div className="ns-container mb-14 space-y-8 text-center sm:text-left">
        <div className="space-y-3">
          <NsReveal delayMs={40}>
            <h2 className="ns-h2">Resultados que se entienden solos.</h2>
          </NsReveal>
          <NsReveal delayMs={100}>
            <p className="text-[var(--ns-muted)]">
              Plataforma de ads confiable para operar presupuestos y gasto con
              claridad.
            </p>
          </NsReveal>
        </div>
        <NsReveal delayMs={160}>
          <Link
            href={routes.register}
            className="ns-btn ns-btn-md ns-btn-secondary"
          >
            Crear cuenta
          </Link>
        </NsReveal>
      </div>

      <div className="ns-marquee">
        <div
          className="pointer-events-none absolute top-0 left-0 z-10 h-full w-[12%] bg-gradient-to-r from-[var(--ns-bg-2)] to-transparent md:w-[18%]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-0 right-0 z-10 h-full w-[12%] bg-gradient-to-l from-[var(--ns-bg-2)] to-transparent md:w-[18%]"
          aria-hidden
        />
        <div className="ns-marquee-track pb-4 pl-8">
          {loop.map((item, i) => (
            <article key={`${item.label}-${i}`} className="ns-result-card">
              <div>
                <p className="ns-result-label mb-2 text-lg text-[var(--ns-muted)]">
                  {item.label}
                </p>
                <p className="ns-result-value ns-h2 text-[2rem]">
                  {item.value}
                </p>
              </div>
              <p className="ns-result-desc text-[var(--ns-muted)]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
