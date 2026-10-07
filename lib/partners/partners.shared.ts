/** Aliados: datos que se pueden usar en cliente y servidor. */

export const PARTNER_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** Cookies de la landing del aliado: quién lo trajo y un id anónimo de visitante. */
export const PARTNER_COOKIE = "ah_partner";
export const VISITOR_COOKIE = "ah_vid";
/** 60 días: tiempo típico en programas de afiliados para atribuir el registro. */
export const PARTNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 60;

export type Partner = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  subheadline: string | null;
  logoUrl: string | null;
  photoUrl: string | null;
  accentColor: string;
  whatsapp: string | null;
  commissionRate: number;
  commissionMonths: number;
  status: "active" | "paused";
  theme: PartnerTheme;
};

export type PartnerTheme = "light" | "dark";

export const PARTNER_ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
export const PARTNER_DEFAULT_ACCENT = "#ff781f";

export function partnerLandingPath(slug: string): string {
  return `/a/${slug}`;
}

/** Texto legible sobre el color del aliado: oscuro en colores claros, blanco en oscuros. */
export function partnerInkOn(hex: string): string {
  const m = PARTNER_ACCENT_RE.test(hex) ? hex.slice(1) : PARTNER_DEFAULT_ACCENT.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return luminance > 0.19 ? "#1c1917" : "#ffffff";
}
