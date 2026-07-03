import type { AffiliateProgramOverview } from "@/types/affiliate";
import { siteConfig } from "@/config/site";

export const affiliatesMock: AffiliateProgramOverview = {
  referralCode: "sandro-wong-mera",
  referralUrl: "https://defaultmedia.mock/ref/sandro-wong-mera",
  stats: {
    totalReferrals: 0,
    activeReferrals: 0,
    estimatedCommission: 0,
    paidCommission: 0,
    clicks: 0,
    registrations: 0,
  },
  selectedBannerSize: "300x250",
  bannerSizes: [
    { id: "300x250", label: "300×250", width: 300, height: 250, formatName: "Medium" },
    { id: "300x300", label: "300×300", width: 300, height: 300, formatName: "Square" },
    { id: "300x600", label: "300×600", width: 300, height: 600, formatName: "Half Page" },
    { id: "320x100", label: "320×100", width: 320, height: 100, formatName: "Mobile" },
    { id: "336x280", label: "336×280", width: 336, height: 280, formatName: "Large Rectangle" },
    { id: "600x314", label: "600×314", width: 600, height: 314, formatName: "Wide" },
    { id: "728x90", label: "728×90", width: 728, height: 90, formatName: "Leaderboard" },
  ],
  milestones: [
    {
      id: "basic",
      name: "Hito básico",
      requirement: "5 referidos activos",
      commission: "5%",
      commissionPercent: 5,
      description: "Ideal para empezar",
    },
    {
      id: "standard",
      name: "Hito estándar",
      requirement: "20 referidos activos",
      commission: "8%",
      commissionPercent: 8,
      description: "Para crecimiento constante",
    },
    {
      id: "professional",
      name: "Hito profesional",
      requirement: "50 referidos activos",
      commission: "12%",
      commissionPercent: 12,
      description: "Máximo potencial",
      isTop: true,
    },
  ],
  steps: [
    {
      id: "share-link",
      step: 1,
      title: "Comparte tu enlace",
      description:
        "Copia tu enlace personal y compártelo con anunciantes o aliados.",
      status: "available",
      optionalAction: "Copiar enlace",
    },
    {
      id: "add-banner",
      step: 2,
      title: "Añade una referencia publicada",
      description:
        "Inserta un banner en tu sitio web o redes para enlazar usuarios directamente.",
      status: "pending",
    },
    {
      id: "referrals-spend",
      step: 3,
      title: "Tus referidos también gastan más",
      description:
        "Cuando tus referidos activan cuentas y consumen presupuesto, acumulas comisión.",
      status: "pending",
    },
    {
      id: "earn",
      step: 4,
      title: "Relájate y empieza a ganar dinero",
      description:
        "Consulta tus avances, hitos y pagos desde este panel.",
      status: "pending",
    },
  ],
  notes: [
    "Las comisiones se calculan sobre el gasto publicitario neto de tus referidos.",
    "Los pagos se procesan mensualmente a través de Cartera Default.",
    `${siteConfig.companyName} se reserva el derecho de modificar los términos del programa.`,
    "No está permitido el spam ni la publicidad engañosa para promocionar tu enlace.",
  ],
};
