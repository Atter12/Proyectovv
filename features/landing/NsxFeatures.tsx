import Image from "next/image";
import Link from "next/link";
import { routes } from "@/config/routes";
import { NsxReveal } from "./NsxReveal.client";

const features = [
  {
    title: "Cartera Holistic",
    body: "Recargá saldo con Stripe u operaciones del equipo. Listo para asignar a ads sin salir del panel.",
    img: "/nexsas/automation/images/ns-img-9.svg",
  },
  {
    title: "Cuentas TikTok Ads",
    body: "Advertisers mapeados por cliente Hecom, fees y estado de sync visibles de un vistazo.",
    img: "/nexsas/automation/images/ns-img-8.svg",
  },
  {
    title: "Pagos y ledger",
    body: "Cobros Hecom, gasto diario, deuda neta estimada y fondeo BM para gerentes.",
    img: "/nexsas/automation/images/ns-img-10.svg",
  },
  {
    title: "Cliente y gerente",
    body: "El cliente ve su scope; el gerente opera cualquier cliente con la misma verdad de datos.",
    img: "/nexsas/automation/images/ns-img-11.svg",
  },
] as const;

const steps = [
  {
    n: "01",
    title: "Recargar cartera",
    body: "Ingresá saldo con Stripe o el flujo que use tu operación Holistic.",
  },
  {
    n: "02",
    title: "Asignar a cuentas ads",
    body: "Distribuí presupuesto a TikTok / advertisers aprobados en segundos.",
  },
  {
    n: "03",
    title: "Gastar y controlar",
    body: "Seguí cobros, gastos diarios y saldo estimado sin salir del panel.",
  },
] as const;

export function NsxFeatures() {
  return (
    <>
      <section id="soluciones" className="nsx-section">
        <div className="nsx-container space-y-14">
          <div className="space-y-8 text-center">
            <div className="space-y-5">
              <NsxReveal delayMs={40}>
                <span className="nsx-badge">Soluciones</span>
              </NsxReveal>
              <div className="space-y-3">
                <NsxReveal delayMs={100}>
                  <h2 className="nsx-h2">
                    Servicios para operar y crecer con control
                  </h2>
                </NsxReveal>
                <NsxReveal delayMs={150}>
                  <p className="mx-auto max-w-[550px] text-[var(--nsx-muted)]">
                    Cartera, cuentas TikTok, pagos Hecom y roles claros — pensado
                    para agencias y equipos de performance en Latam.
                  </p>
                </NsxReveal>
              </div>
            </div>
            <NsxReveal delayMs={200}>
              <Link
                href={routes.register}
                className="nsx-btn nsx-btn-white inline-flex"
              >
                Ver el panel
              </Link>
            </NsxReveal>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {features.map((item, i) => (
              <NsxReveal key={item.title} delayMs={80 + i * 60}>
                <div className="nsx-feature-card">
                  <div className="space-y-1">
                    <h3 className="nsx-h3">{item.title}</h3>
                    <p className="text-[0.95rem] text-[var(--nsx-muted)]">
                      {item.body}
                    </p>
                  </div>
                  <figure className="mx-auto mt-6 flex max-h-56 items-center justify-center">
                    <Image
                      src={item.img}
                      alt=""
                      width={320}
                      height={220}
                      className="h-auto max-h-52 w-auto object-contain"
                    />
                  </figure>
                </div>
              </NsxReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="proceso" className="nsx-section !pt-0">
        <div className="nsx-container space-y-10">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <NsxReveal delayMs={40}>
              <span className="nsx-badge">Proceso</span>
            </NsxReveal>
            <NsxReveal delayMs={100}>
              <h2 className="nsx-h2">
                Nuestro flujo para crecer tu operación de ads
              </h2>
            </NsxReveal>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <NsxReveal key={step.n} delayMs={80 + i * 70}>
                <div className="nsx-card space-y-3">
                  <p className="text-sm font-semibold text-[#ff781f]">
                    {step.n}
                  </p>
                  <h3 className="nsx-h3">{step.title}</h3>
                  <p className="text-[0.95rem] text-[var(--nsx-muted)]">
                    {step.body}
                  </p>
                </div>
              </NsxReveal>
            ))}
          </div>
        </div>
      </section>

      <section id="resultados" className="nsx-section !pt-0">
        <div className="nsx-container">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                value: "+180",
                label: "Equipos",
                detail: "Agencias y performance en Latam",
              },
              {
                value: "Hoy / 7d",
                label: "Gasto",
                detail: "Visibilidad diaria en el overview",
              },
              {
                value: "2 roles",
                label: "Scope",
                detail: "Cliente y gerente, misma verdad",
              },
            ].map((item, i) => (
              <NsxReveal key={item.label} delayMs={60 + i * 50}>
                <div className="nsx-card space-y-2 text-center sm:text-left">
                  <p className="text-sm text-[var(--nsx-muted)]">{item.label}</p>
                  <p className="nsx-h2 text-[2rem]">{item.value}</p>
                  <p className="text-sm text-[var(--nsx-muted)]">{item.detail}</p>
                </div>
              </NsxReveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
