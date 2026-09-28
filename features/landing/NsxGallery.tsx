import Image from "next/image";
import type { LandingCopy } from "./i18n/landing-copy";

/** Imágenes en el mismo orden que `copy.gallery.items`. */
const GALLERY_SRCS = [
  "/landing/holistic/gallery-01.png",
  "/landing/holistic/gallery-02.png",
  "/landing/holistic/gallery-03.png",
  "/landing/holistic/gallery-04.png",
  "/landing/holistic/gallery-05.png",
  "/landing/holistic/gallery-06.png",
] as const;

export function NsxGallery({ copy }: { copy: LandingCopy["gallery"] }) {
  const items = GALLERY_SRCS.map((src, i) => ({ src, ...copy.items[i] }));

  return (
    <section
      className="nsx-section nsx-gallery"
      id="resultados"
      aria-labelledby="gallery-title"
    >
      <div className="nsx-container">
        <div className="nsx-section-head nsx-gallery-head">
          <span className="nsx-pill">{copy.pill}</span>
          <h2 className="nsx-h2" id="gallery-title">
            {copy.title}
          </h2>
          <p>{copy.lead}</p>
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
