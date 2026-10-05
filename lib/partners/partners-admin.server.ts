import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { partnerPanelUrl } from "./partner-panel-token";

export type PartnerWithStats = {
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
  notes: string | null;
  createdAt: string;
  /** Link privado del panel del aliado (null si falta el secreto). */
  panelUrl: string | null;
  stats: {
    visits30d: number;
    uniqueVisitors30d: number;
    visitsTotal: number;
    signups: number;
    payingClients: number;
    commissionPendingCents: number;
    commissionPaidCents: number;
    feeCents: number;
  };
};

/** Aliados con su embudo: visitas → registros → clientes que pagan → comisión. */
export async function listPartnersWithStats(): Promise<PartnerWithStats[]> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [{ data: partners, error }, { data: clients }, { data: commissions }, { data: visits30 }] = await Promise.all([
    admin.from("partners").select("*").order("created_at", { ascending: false }),
    admin.from("partner_clients").select("partner_id,hecom_cliente_id"),
    admin.from("partner_commissions").select("partner_id,hecom_cliente_id,commission_cents,fee_cents,status"),
    admin.from("partner_visits").select("partner_id,visitor_id").gte("visited_at", since).limit(100000),
  ]);
  if (error) throw new Error(error.message);

  const result: PartnerWithStats[] = [];
  for (const p of partners ?? []) {
    const { count: visitsTotal } = await admin
      .from("partner_visits")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", p.id);
    const mine30 = (visits30 ?? []).filter((v) => v.partner_id === p.id);
    const mineCommissions = (commissions ?? []).filter((c) => c.partner_id === p.id && c.status !== "void");
    result.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      headline: p.headline,
      subheadline: p.subheadline,
      logoUrl: p.logo_url,
      photoUrl: p.photo_url,
      accentColor: p.accent_color,
      whatsapp: p.whatsapp,
      commissionRate: Number(p.commission_rate),
      commissionMonths: p.commission_months,
      status: p.status,
      notes: p.notes,
      createdAt: p.created_at,
      panelUrl: serverEnv.holisticWaSnapshotSecret ? partnerPanelUrl(p.id, serverEnv.holisticWaSnapshotSecret) : null,
      stats: {
        visits30d: mine30.length,
        uniqueVisitors30d: new Set(mine30.map((v) => v.visitor_id).filter(Boolean)).size,
        visitsTotal: visitsTotal ?? 0,
        signups: (clients ?? []).filter((c) => c.partner_id === p.id).length,
        payingClients: new Set(mineCommissions.map((c) => c.hecom_cliente_id)).size,
        commissionPendingCents: mineCommissions
          .filter((c) => c.status === "pending")
          .reduce((s, c) => s + Number(c.commission_cents), 0),
        commissionPaidCents: mineCommissions
          .filter((c) => c.status === "paid")
          .reduce((s, c) => s + Number(c.commission_cents), 0),
        feeCents: mineCommissions.reduce((s, c) => s + Number(c.fee_cents), 0),
      },
    });
  }
  return result;
}
