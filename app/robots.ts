import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/seo";

/** Rutas privadas: panel, API, admin, flujos de acceso y enlaces firmados. */
const PRIVATE_PATHS = [
  "/api/",
  "/admin/",
  "/auth/",
  "/p/",
  "/r/",
  "/sign-in",
  "/sign-up",
  "/verify-otp",
  "/forgot-password",
  "/account-setup",
  "/contrato",
  "/pago",
  "/carrito",
  "/overview",
  "/clientes",
  "/ad-accounts",
  "/payments",
  "/links-deuda",
  "/monitoreo",
  "/gastos",
  "/affiliates",
  "/creative-analyzer",
  "/profit",
  "/asistente",
  "/alianzas",
  "/education",
  "/pixels",
  "/support",
  "/cobros",
  "/contratos-registro",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PATHS,
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
