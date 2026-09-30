import type { MetadataRoute } from "next";
import { routes } from "@/config/routes";
import { absoluteUrl } from "@/config/seo";

/** Páginas públicas indexables. La landing declara sus versiones por idioma. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl(routes.home),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      alternates: {
        languages: {
          "es-PE": absoluteUrl(routes.home),
          en: absoluteUrl("/?lang=en"),
          "pt-BR": absoluteUrl("/?lang=pt"),
          "zh-CN": absoluteUrl("/?lang=zh"),
        },
      },
    },
    { url: absoluteUrl(routes.shop), lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: absoluteUrl(routes.register), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl(routes.login), lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: absoluteUrl(routes.terms), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl(routes.returns), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl(routes.complaints), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
