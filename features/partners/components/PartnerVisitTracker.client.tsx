"use client";

import { useEffect } from "react";

/** Cuenta la visita a la landing del aliado y deja sus cookies de atribución. */
export function PartnerVisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const pick = (key: string) => url.searchParams.get(key);
    void fetch("/api/partners/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        path: url.pathname,
        referrer: document.referrer || null,
        utm_source: pick("utm_source"),
        utm_medium: pick("utm_medium"),
        utm_campaign: pick("utm_campaign"),
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);
  return null;
}
