import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

const images = {
  tall: "/landing/holistic/about-tall.png",
  wide: "/landing/holistic/about-wide.png",
};

const stats = [
  { value: "+180", label: "equipos y agencias en la red" },
  { value: "TikTok", label: "cuentas, Business Manager y recargas" },
  {
    value: "Stripe + Hecom",
    label: "recargas del cliente y cobros CRM al día real",
  },
];

export function NsxAbout() {
  return (
    <section className="nsx-section" id="nosotros">
      <div className="nsx-container">
        <div className="nsx-about-top">
          <div>
            <span className="nsx-pill">Nosotros</span>
            <h2 className="nsx-h2">El equipo detrás de {siteConfig.name}</h2>
          </div>
          <div className="nsx-about-lead">
            <p>
              Construimos este panel para un problema real de Latam: demasiado
              tiempo en Excel y demasiada fricción entre cartera, recargas TikTok y
              la operación Hecom Club de cada cliente.
            </p>
            <Link href="#producto" className="nsx-btn-outline">
              Conocer el producto
            </Link>
          </div>
        </div>

        <div className="nsx-stats">
          {stats.map((s) => (
            <div key={s.value} className="nsx-stat">
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <div className="nsx-about-media">
          <div className="nsx-media-tall">
            <Image
              src={images.tall}
              alt={`${siteConfig.name}: equipo revisando operación publicitaria`}
              width={660}
              height={1040}
              sizes="(max-width: 991px) 100vw, 40vw"
            />
          </div>
          <div className="nsx-media-wide">
            <Image
              src={images.wide}
              alt="Sala de operación digital con monitores de campañas TikTok"
              width={842}
              height={576}
              sizes="(max-width: 991px) 100vw, 50vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
