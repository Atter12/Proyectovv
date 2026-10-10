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
  /** Empresa o marca del aliado (la landing la muestra junto a su logo). */
  companyName: string | null;
  headline: string | null;
  subheadline: string | null;
  logoUrl: string | null;
  photoUrl: string | null;
  accentColor: string;
  whatsapp: string | null;
  commissionRate: number;
  commissionDays: number;
  status: "active" | "paused";
  theme: PartnerTheme;
  /** Marca de la landing (opcional; sin valor manda el tema claro/oscuro). */
  secondaryColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  /** Alto del logo del aliado en la landing, en px. */
  logoSize: number | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  bannerMobileUrl: string | null;
  bannerLink: string | null;
};

export type PartnerTheme = "light" | "dark";

export const PARTNER_ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
export const PARTNER_DEFAULT_ACCENT = "#ff781f";

export function partnerLandingPath(slug: string): string {
  return `/a/${slug}`;
}

export const PARTNER_LOGO_SIZE = { min: 24, max: 96, default: 40 } as const;

export const PARTNER_THEME_COLORS: Record<PartnerTheme, { background: string; text: string }> = {
  light: { background: "#fcfbf9", text: "#1c1917" },
  dark: { background: "#14110f", text: "#ffffff" },
};

export function partnerLogoSize(raw: number | null | undefined): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return PARTNER_LOGO_SIZE.default;
  return Math.min(PARTNER_LOGO_SIZE.max, Math.max(PARTNER_LOGO_SIZE.min, n));
}

const hexOr = (hex: string | null | undefined, fallback: string) =>
  hex && PARTNER_ACCENT_RE.test(hex) ? hex : fallback;

/**
 * Colores finales de la landing. Lo secundario, bordes y tarjetas salen de
 * mezclar el texto con el fondo, así cualquier combinación se ve pareja.
 */
export function partnerPalette(p: {
  accentColor: string;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  theme: PartnerTheme;
}) {
  const base = PARTNER_THEME_COLORS[p.theme === "dark" ? "dark" : "light"];
  const accent = hexOr(p.accentColor, PARTNER_DEFAULT_ACCENT);
  const secondary = hexOr(p.secondaryColor, accent);
  const background = hexOr(p.backgroundColor, base.background);
  const text = hexOr(p.textColor, base.text);
  const mix = (pct: number) => `color-mix(in srgb, ${text} ${pct}%, ${background})`;
  return {
    accent,
    accentInk: partnerInkOn(accent),
    secondary,
    secondaryInk: partnerInkOn(secondary),
    background,
    text,
    /** Fondo oscuro: el logo de Holistic va en blanco. */
    dark: partnerInkOn(background) === "#ffffff",
    muted: mix(72),
    faint: mix(38),
    border: mix(12),
    card: mix(4),
    band: mix(2),
  };
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
