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
};

export function partnerLandingPath(slug: string): string {
  return `/a/${slug}`;
}
