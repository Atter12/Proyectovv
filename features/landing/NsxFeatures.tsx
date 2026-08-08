import Image from "next/image";
import Link from "next/link";
import { routes } from "@/config/routes";
import { NsxReveal } from "./NsxReveal.client";

const features = [
  {
    title: "App integrations",
    body: "Connect all your favorite tools in one place and automate workflows.",
    img: "/nexsas/automation/images/ns-img-9.svg",
  },
  {
    title: "Real-time triggers",
    body: "Start automations instantly based on events, conditions, and user actions.",
    img: "/nexsas/automation/images/ns-img-8.svg",
  },
  {
    title: "Smart conditions",
    body: "Build logic that adapts — branch workflows with rules that actually fit ops.",
    img: "/nexsas/automation/images/ns-img-10.svg",
  },
  {
    title: "Multi-step automation",
    body: "Chain tasks end-to-end so teams stop copy-pasting between tools.",
    img: "/nexsas/automation/images/ns-img-11.svg",
  },
] as const;

export function NsxFeatures() {
  return (
    <section id="features" className="nsx-section">
      <div className="nsx-container space-y-14">
        <div className="space-y-8 text-center">
          <div className="space-y-5">
            <NsxReveal delayMs={40}>
              <span className="nsx-badge">Features</span>
            </NsxReveal>
            <div className="space-y-3">
              <NsxReveal delayMs={100}>
                <h2 className="nsx-h2">Real results teams experience</h2>
              </NsxReveal>
              <NsxReveal delayMs={150}>
                <p className="mx-auto max-w-[550px] text-[var(--nsx-muted)]">
                  From faster workflows to improved collaboration, every feature
                  is designed to deliver real, trackable results that teams can
                  rely on every day.
                </p>
              </NsxReveal>
            </div>
          </div>
          <NsxReveal delayMs={200}>
            <Link href={routes.register} className="nsx-btn nsx-btn-white inline-flex">
              View all features
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
  );
}
