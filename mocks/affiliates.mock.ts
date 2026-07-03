import type { AffiliateProgram } from "@/types/affiliate";
import { siteConfig } from "@/config/site";

export const affiliatesMock: AffiliateProgram = {
  referralLink: "https://defaultmedia.mock/ref/sandro-wong-mera",
  bannerSizes: [
    { id: "300x250", label: "300×250", width: 300, height: 250 },
    { id: "300x300", label: "300×300", width: 300, height: 300 },
    { id: "300x600", label: "300×600", width: 300, height: 600 },
    { id: "320x100", label: "320×100", width: 320, height: 100 },
    { id: "336x280", label: "336×280", width: 336, height: 280 },
    { id: "600x314", label: "600×314", width: 600, height: 314 },
    { id: "728x90", label: "728×90", width: 728, height: 90 },
  ],
  milestones: [
    {
      id: "basic",
      name: "Hito básico",
      requirement: "5 referidos activos",
      commission: "5% de comisión",
    },
    {
      id: "standard",
      name: "Hito estándar",
      requirement: "20 referidos activos",
      commission: "8% de comisión",
    },
    {
      id: "professional",
      name: "Hito profesional",
      requirement: "50 referidos activos",
      commission: "12% de comisión",
    },
  ],
  notes: [
    "Las comisiones se calculan sobre el gasto publicitario neto de tus referidos.",
    "Los pagos de afiliados se procesan mensualmente a través de Cartera Default.",
    `${siteConfig.companyName} se reserva el derecho de modificar los términos del programa.`,
    "No está permitido el spam ni la publicidad engañosa para promocionar tu enlace.",
  ],
};
