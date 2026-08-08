import Link from "next/link";
import { routes } from "@/config/routes";
import { NsReveal } from "./NsReveal.client";

const services = [
  {
    title: "Cartera y recargas",
    description:
      "Saldo central para operar. Stripe para clientes; fondeo BM para el equipo Holistic.",
  },
  {
    title: "Cuentas TikTok Ads",
    description:
      "Advertisers mapeados por cliente, estado de sync y fees visibles en un vistazo.",
  },
  {
    title: "Gasto diario",
    description:
      "Snapshots de spend del día, 7d y 30d — mismos números para gerente y cliente.",
  },
  {
    title: "Pagos y asignaciones",
    description:
      "Historial de cobros Hecom, deuda neta estimada y presupuestos hacia ads.",
  },
  {
    title: "Clientes multi-rol",
    description:
      "El gerente opera cualquier cliente; el cliente ve solo su scope, sin fricción.",
  },
  {
    title: "Operación sin planillas",
    description:
      "Menos Excel y más control: un panel pensado para performance Latam.",
  },
] as const;

export function NsServices() {
  return (
    <section id="servicios" className="ns-section">
      <div className="ns-container">
        <div className="flex flex-col items-start justify-center gap-14 md:flex-row md:justify-between md:gap-x-20 lg:gap-x-[7.5rem]">
          <div className="lg:sticky lg:top-28">
            <NsReveal delayMs={40}>
              <span className="ns-badge mb-5">Servicios</span>
            </NsReveal>
            <div className="mb-10 space-y-2 md:mb-14 md:max-w-[36rem]">
              <NsReveal delayMs={100}>
                <h2 className="ns-h2">Operación ads orientada a resultados.</h2>
              </NsReveal>
              <NsReveal delayMs={160}>
                <p className="max-w-[32rem] text-[var(--ns-muted)]">
                  Simple, seguro y listo para crecer: Holistic te da el control
                  de la plata y las cuentas sin renunciar a la velocidad.
                </p>
              </NsReveal>
            </div>
            <NsReveal delayMs={220}>
              <Link
                href={routes.register}
                className="ns-btn ns-btn-md ns-btn-secondary"
              >
                Ver el panel en acción
              </Link>
            </NsReveal>
          </div>

          <ul className="w-full max-w-xl space-y-4">
            {services.map((service, i) => (
              <NsReveal as="li" key={service.title} delayMs={120 + i * 70}>
                <div className="ns-service-card space-y-3">
                  <div
                    aria-hidden
                    className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--ns-primary-soft)] text-[var(--ns-primary)]"
                  >
                    <span className="text-lg font-semibold tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="ns-h3 text-[1.2rem]">{service.title}</h3>
                  <p className="text-[0.95rem] leading-relaxed text-[var(--ns-muted)]">
                    {service.description}
                  </p>
                </div>
              </NsReveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
