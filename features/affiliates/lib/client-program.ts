/** Demo de afiliados. Solo estas cuentas ven referidos de smoke. */
const AFFILIATE_SMOKE_EMAILS = ["sandrowonmer@gmail.com"] as const;

export function canViewAffiliateSmoke(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  return (AFFILIATE_SMOKE_EMAILS as readonly string[]).includes(normalized);
}

/** Descuento fijo por cliente cerrado. El referido no paga la entrada. */
export const CLIENT_AFFILIATE_REWARD_USD = 15;

export const CLIENT_REFERRAL_STAGES = [
  "registered",
  "negotiating",
  "contract_sent",
  "closed",
  "declined",
] as const;

export type ClientReferralStage = (typeof CLIENT_REFERRAL_STAGES)[number];

export type ClientAffiliateTab = "referrals" | "discounts" | "how" | "materials";

export interface ClientAffiliateReferral {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  registeredAt: string;
  stage: ClientReferralStage;
  /** Monto mostrado en la fila. En cerrados es el descuento ganado. */
  benefitUsd: number;
  earned: boolean;
  discountStatus: "none" | "pending" | "applied";
  appliedAt: string | null;
}

export interface ClientAffiliateStats {
  total: number;
  closed: number;
  negotiating: number;
  discountsEarnedUsd: number;
}

export interface ClientAffiliateProgramView {
  smoke: boolean;
  rewardUsd: number;
  referralCode: string;
  shareUrl: string;
  displayPath: string;
  referrals: ClientAffiliateReferral[];
  stats: ClientAffiliateStats;
}

export interface ReferralSource {
  id: string;
  status: string;
  commissionAmountCents: number;
  createdAt: string;
  paidAt: string | null;
  metadata: Record<string, unknown> | null;
  organizationName: string | null;
  organizationEmail: string | null;
}

const STATUS_STAGE = {
  pending: "registered",
  active: "negotiating",
  paused: "contract_sent",
  converted: "closed",
  closed: "declined",
} as const satisfies Record<string, ClientReferralStage>;

const STAGES = new Set<string>(CLIENT_REFERRAL_STAGES);

export function formatAffiliateUsd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `US$${body}`;
}

export function buildReferralShareUrl(appUrl: string, code: string): string {
  const base = appUrl.replace(/\/$/, "");
  const safe = code.trim();
  if (!safe || safe === "—" || safe === "pending") return `${base}/register`;
  return `${base}/r/${encodeURIComponent(safe)}`;
}

export function referralDisplayPath(shareUrl: string): string {
  try {
    const url = new URL(shareUrl);
    return `${url.host}${decodeURIComponent(url.pathname)}`;
  } catch {
    return shareUrl;
  }
}

export function referralInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second =
    parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

export function summarizeClientReferrals(
  referrals: ClientAffiliateReferral[],
): ClientAffiliateStats {
  const closed = referrals.filter((row) => row.earned);
  return {
    total: referrals.length,
    closed: closed.length,
    negotiating: referrals.filter((row) => row.stage === "negotiating").length,
    discountsEarnedUsd: closed.reduce((sum, row) => sum + row.benefitUsd, 0),
  };
}

function readString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stageFromSource(source: ReferralSource): ClientReferralStage {
  if (source.status === "converted") return "closed";
  if (source.status === "closed") return "declined";

  const explicit = readString(source.metadata, "pipeline_stage");
  if (
    explicit &&
    STAGES.has(explicit) &&
    explicit !== "closed" &&
    explicit !== "declined"
  ) {
    return explicit as ClientReferralStage;
  }

  if (source.status in STATUS_STAGE) {
    return STATUS_STAGE[source.status as keyof typeof STATUS_STAGE];
  }
  return "registered";
}

function benefitForClosed(cents: number, rewardUsd: number): number {
  if (Number.isFinite(cents) && cents > 0) return Math.round(cents) / 100;
  return rewardUsd;
}

export function mapReferralSource(
  source: ReferralSource,
  rewardUsd: number,
): ClientAffiliateReferral {
  const stage = stageFromSource(source);
  const earned = stage === "closed";
  const email =
    readString(source.metadata, "referred_email") ?? source.organizationEmail;
  const company =
    readString(source.metadata, "company") ?? source.organizationName;
  const name =
    readString(source.metadata, "referred_name") ??
    readString(source.metadata, "contact_name") ??
    company ??
    email ??
    "Referido";
  const appliedAt = earned ? source.paidAt : null;

  return {
    id: source.id,
    name,
    company: company && company !== name ? company : company,
    email,
    registeredAt: source.createdAt,
    stage,
    benefitUsd: stage === "declined" ? 0 : earned ? benefitForClosed(source.commissionAmountCents, rewardUsd) : rewardUsd,
    earned,
    discountStatus: !earned ? "none" : appliedAt ? "applied" : "pending",
    appliedAt,
  };
}

export function smokeClientReferrals(rewardUsd: number): ClientAffiliateReferral[] {
  const row = (input: {
    id: string;
    name: string;
    company: string;
    email: string;
    registeredAt: string;
    stage: ClientReferralStage;
    appliedAt?: string | null;
  }): ClientAffiliateReferral => {
    const earned = input.stage === "closed";
    const appliedAt = earned ? (input.appliedAt ?? null) : null;
    return {
      id: input.id,
      name: input.name,
      company: input.company,
      email: input.email,
      registeredAt: input.registeredAt,
      stage: input.stage,
      benefitUsd: input.stage === "declined" ? 0 : rewardUsd,
      earned,
      discountStatus: !earned ? "none" : appliedAt ? "applied" : "pending",
      appliedAt,
    };
  };

  return [
    row({
      id: "smoke-carlos",
      name: "Carlos Mendoza",
      company: "Mendoza Store",
      email: "carlos@mendozastore.com",
      registeredAt: "2026-09-25T15:00:00.000Z",
      stage: "negotiating",
    }),
    row({
      id: "smoke-maria",
      name: "María Torres",
      company: "Fit & Healthy",
      email: "maria@fithealthy.com",
      registeredAt: "2026-09-18T15:00:00.000Z",
      stage: "closed",
      appliedAt: "2026-09-22T15:00:00.000Z",
    }),
    row({
      id: "smoke-peru",
      name: "Ecommerce Perú",
      company: "Tienda Online",
      email: "hola@ecommerceperu.com",
      registeredAt: "2026-09-12T15:00:00.000Z",
      stage: "contract_sent",
    }),
    row({
      id: "smoke-luis",
      name: "Luis García",
      company: "Importaciones LG",
      email: "luis@importacioneslg.com",
      registeredAt: "2026-09-10T15:00:00.000Z",
      stage: "registered",
    }),
    row({
      id: "smoke-andrea",
      name: "Andrea López",
      company: "López Store",
      email: "andrea@lopezstore.com",
      registeredAt: "2026-09-05T15:00:00.000Z",
      stage: "closed",
      appliedAt: "2026-09-14T15:00:00.000Z",
    }),
    row({
      id: "smoke-diego",
      name: "Diego Herrera",
      company: "DH Market",
      email: "diego@dhmarket.com",
      registeredAt: "2026-09-02T15:00:00.000Z",
      stage: "closed",
    }),
    row({
      id: "smoke-sofia",
      name: "Sofía Ramírez",
      company: "Casa Verde",
      email: "sofia@casaverde.com",
      registeredAt: "2026-08-28T15:00:00.000Z",
      stage: "negotiating",
    }),
    row({
      id: "smoke-camila",
      name: "Camila Rojas",
      company: "Rojas Beauty",
      email: "camila@rojasbeauty.com",
      registeredAt: "2026-08-22T15:00:00.000Z",
      stage: "registered",
    }),
  ];
}

export function resolveClientAffiliateView(input: {
  email: string | null | undefined;
  rewardUsd: number;
  referralCode: string;
  shareUrl: string;
  displayPath: string;
  liveReferrals: ClientAffiliateReferral[];
  /** El smoke no se muestra al ver el panel de otro cliente. */
  allowSmoke?: boolean;
}): ClientAffiliateProgramView {
  const useSmoke =
    input.allowSmoke !== false &&
    canViewAffiliateSmoke(input.email) &&
    input.liveReferrals.length === 0;
  const referrals = useSmoke
    ? smokeClientReferrals(input.rewardUsd)
    : input.liveReferrals;

  return {
    smoke: useSmoke,
    rewardUsd: input.rewardUsd,
    referralCode: input.referralCode,
    shareUrl: input.shareUrl,
    displayPath: input.displayPath,
    referrals,
    stats: summarizeClientReferrals(referrals),
  };
}
