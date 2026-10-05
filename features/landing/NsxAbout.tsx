import Image from "next/image";
import Link from "next/link";
import type { LandingCopy } from "./i18n/landing-copy";

const images = {
  tall: "/landing/holistic/about-tall.png",
  wide: "/landing/holistic/about-wide.png",
};

const STAT_VALUES = ["+180", "TikTok", "Pagos + Hecom"] as const;

export function NsxAbout({ copy }: { copy: LandingCopy["about"] }) {
  const stats = STAT_VALUES.map((value, i) => ({ value, label: copy.stats[i] }));

  return (
    <section className="nsx-section" id="nosotros">
      <div className="nsx-container">
        <div className="nsx-about-top">
          <div>
            <span className="nsx-pill">{copy.pill}</span>
            <h2 className="nsx-h2">{copy.title}</h2>
          </div>
          <div className="nsx-about-lead">
            <p>{copy.lead}</p>
            <Link href="#producto" className="nsx-btn-outline">
              {copy.cta}
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
              alt={copy.imageTallAlt}
              width={660}
              height={1040}
              sizes="(max-width: 991px) 100vw, 40vw"
            />
          </div>
          <div className="nsx-media-wide">
            <Image
              src={images.wide}
              alt={copy.imageWideAlt}
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
