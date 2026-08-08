import Image from "next/image";
import { siteConfig } from "@/config/site";

const items = [
  {
    src: "/landing/holistic/gallery-01.png",
    alt: "Equipo de growth en sesión de planificación",
    caption: "Planificación semanal",
  },
  {
    src: "/landing/holistic/gallery-02.png",
    alt: "Panel de gasto y cartera en monitor",
    caption: "Cartera y gasto en vivo",
  },
  {
    src: "/landing/holistic/gallery-03.png",
    alt: "Creadores grabando contenido en estudio",
    caption: "Contenido y creativos",
  },
  {
    src: "/landing/holistic/gallery-04.png",
    alt: "Análisis de métricas TikTok en oficina",
    caption: "Métricas TikTok",
  },
  {
    src: "/landing/holistic/gallery-05.png",
    alt: "Laptops con reportes de campañas",
    caption: "Cierres y reportes",
  },
  {
    src: "/landing/holistic/gallery-06.png",
    alt: "Colaboración en war room de marketing",
    caption: "Coordinación de cuenta",
  },
] as const;

export function NsxGallery() {
  return (
    <section
      className="nsx-section nsx-gallery"
      id="resultados"
      aria-labelledby="gallery-title"
    >
      <div className="nsx-container">
        <div className="nsx-section-head nsx-gallery-head">
          <span className="nsx-pill">Resultados en entorno real</span>
          <h2 className="nsx-h2" id="gallery-title">
            Así se ve la operación en el día a día
          </h2>
          <p>
            Del war room al detalle de cada cuenta: el mismo ritmo con el que
            trabajamos TikTok Ads y Hecom Club para los clientes de{" "}
            {siteConfig.name}.
          </p>
        </div>

        <div className="nsx-gallery-grid">
          {items.map((item) => (
            <figure key={item.src} className="nsx-gallery-item">
              <Image
                src={item.src}
                alt={item.alt}
                width={960}
                height={720}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <figcaption>{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
