import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ads Holistic",
    short_name: "Holistic",
    description: "Panel de recargas, cuentas y cobros.",
    start_url: "/overview",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fcfbf9",
    theme_color: "#fcfbf9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
