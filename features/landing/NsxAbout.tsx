import Image from "next/image";
import Link from "next/link";
import { routes } from "@/config/routes";
import { NsxReveal } from "./NsxReveal.client";

export function NsxAbout() {
  return (
    <section id="about" className="nsx-section relative z-10 -mt-8 bg-[var(--nsx-bg)] md:-mt-16">
      <div className="nsx-container">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10 xl:gap-14">
          <NsxReveal delayMs={80} className="lg:col-span-3">
            <figure className="h-[28rem] w-full overflow-hidden rounded-[20px] lg:h-[32.5rem]">
              <Image
                src="/nexsas/automation/images/ns-img-6.jpg"
                alt=""
                width={640}
                height={900}
                className="size-full object-cover"
              />
            </figure>
          </NsxReveal>

          <div className="lg:col-span-9">
            <div className="flex w-full flex-col gap-y-8 xl:gap-y-14">
              <div className="flex flex-col items-center justify-center gap-y-8 md:gap-x-8 lg:flex-row xl:gap-x-14">
                <div className="w-full space-y-5 lg:w-1/2">
                  <NsxReveal delayMs={100}>
                    <span className="nsx-badge">About Us</span>
                  </NsxReveal>
                  <NsxReveal delayMs={140}>
                    <h2 className="nsx-h2">The team behind smarter automation</h2>
                  </NsxReveal>
                </div>
                <div className="w-full space-y-8 lg:w-1/2">
                  <NsxReveal delayMs={180}>
                    <p className="text-[1.05rem] leading-relaxed text-[var(--nsx-muted)]">
                      We created this platform to solve one simple problem — too
                      much time is wasted on repetitive work.
                    </p>
                  </NsxReveal>
                  <NsxReveal delayMs={220}>
                    <Link
                      href={routes.register}
                      className="nsx-btn nsx-btn-white inline-flex"
                    >
                      Learn more
                    </Link>
                  </NsxReveal>
                </div>
              </div>

              <div className="flex flex-col items-stretch justify-end gap-5 md:flex-row md:gap-8 xl:gap-14">
                <div className="w-full space-y-8 md:w-1/2">
                  <div className="flex items-center gap-x-10">
                    <div className="space-y-1">
                      <p className="nsx-h3">
                        90<span className="text-[1.1rem]">%</span>
                      </p>
                      <p className="text-sm text-[var(--nsx-muted)]">
                        Client Satisfaction
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="nsx-h3">
                        10<span className="text-[1.1rem]">M+</span>
                      </p>
                      <p className="text-sm text-[var(--nsx-muted)]">
                        automated workflows
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="nsx-h3 flex items-center gap-2">
                      4.9
                      <span className="text-[var(--nsx-lime-deep)]" aria-hidden>
                        ★★★★★
                      </span>
                    </p>
                    <p className="text-sm text-[var(--nsx-muted)]">
                      Average rating from product reviews
                    </p>
                  </div>
                </div>
                <figure className="h-[16rem] w-full overflow-hidden rounded-[20px] md:h-auto md:w-1/2">
                  <Image
                    src="/nexsas/automation/images/ns-img-7.jpg"
                    alt=""
                    width={800}
                    height={600}
                    className="size-full object-cover"
                  />
                </figure>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
