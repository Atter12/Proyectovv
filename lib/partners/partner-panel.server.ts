import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";

export type PartnerPanelClient = {
  /** Nombre recortado: el aliado ve a quién trajo, sin datos completos. */
  displayName: string;
  attributedAt: string;
  expiresAt: string;
  payments: number;
  feeCents: number;
  commissionCents: number;
};

export type PartnerPanelData = {
  partner: { id: string; slug: string; name: string; commissionRate: number; commissionMonths: number; status: "active" | "paused" };
  visits30d: number;
  uniqueVisitors30d: number;
  visitsTotal: number;
  topSources: Array<{ source: string; visits: number }>;
  clients: PartnerPanelClient[];
  commissionPendingCents: number;
  commissionPaidCents: number;
  months: Array<{ month: string; commissionCents: number; status: "pending" | "paid" | "mixed" }>;
};

/** «María Fernanda Quispe» → «María F.»: suficiente para reconocerlo, sin exponerlo. */
function maskName(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Cliente";
  const first = parts[0]!;
  const initial = parts[1] ? ` ${parts[1][0]!.toUpperCase()}.` : "";
  return `${first}${initial}`;
}

export async function getPartnerPanelData(partnerId: string): Promise<PartnerPanelData | null> {
  const admin = createAdminClient();
  const { data: p } = await admin
    .from("partners")
    .select("id,slug,name,commission_rate,commission_months,status")
    .eq("id", partnerId)
    .maybeSingle();
  if (!p) return null;

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [{ data: visits30 }, { count: visitsTotal }, { data: clientRows }, { data: commissions }] = await Promise.all([
    admin.from("partner_visits").select("visitor_id,utm_source,referrer").eq("partner_id", partnerId).gte("visited_at", since).limit(50000),
    admin.from("partner_visits").select("id", { count: "exact", head: true }).eq("partner_id", partnerId),
    admin.from("partner_clients").select("hecom_cliente_id,attributed_at,expires_at").eq("partner_id", partnerId).order("attributed_at", { ascending: false }),
    admin.from("partner_commissions").select("hecom_cliente_id,fee_cents,commission_cents,status,earned_at").eq("partner_id", partnerId).neq("status", "void"),
  ]);

  const sourceOf = (v: { utm_source: string | null; referrer: string | null }) => {
    if (v.utm_source) return v.utm_source.toLowerCase();
    if (!v.referrer) return "directo";
    try {
      return new URL(v.referrer).hostname.replace(/^www\./, "");
    } catch {
      return "otro";
    }
  };
  const bySource = new Map<string, number>();
  for (const v of visits30 ?? []) bySource.set(sourceOf(v), (bySource.get(sourceOf(v)) ?? 0) + 1);

  const ids = (clientRows ?? []).map((c) => c.hecom_cliente_id);
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: hecomClientes } = await createHecomAdminClient().from("clientes").select("id,name").in("id", ids);
    for (const c of hecomClientes ?? []) names.set(String(c.id), String(c.name ?? ""));
  }

  const clients: PartnerPanelClient[] = (clientRows ?? []).map((c) => {
    const mine = (commissions ?? []).filter((x) => x.hecom_cliente_id === c.hecom_cliente_id);
    return {
      displayName: maskName(names.get(c.hecom_cliente_id)),
      attributedAt: c.attributed_at,
      expiresAt: c.expires_at,
      payments: mine.length,
      feeCents: mine.reduce((s, x) => s + Number(x.fee_cents), 0),
      commissionCents: mine.reduce((s, x) => s + Number(x.commission_cents), 0),
    };
  });

  const monthMap = new Map<string, { cents: number; statuses: Set<string> }>();
  for (const c of commissions ?? []) {
    const key = String(c.earned_at).slice(0, 7);
    const m = monthMap.get(key) ?? { cents: 0, statuses: new Set<string>() };
    m.cents += Number(c.commission_cents);
    m.statuses.add(c.status);
    monthMap.set(key, m);
  }

  return {
    partner: {
      id: p.id,
      slug: p.slug,
      name: p.name,
      commissionRate: Number(p.commission_rate),
      commissionMonths: p.commission_months,
      status: p.status,
    },
    visits30d: visits30?.length ?? 0,
    uniqueVisitors30d: new Set((visits30 ?? []).map((v) => v.visitor_id).filter(Boolean)).size,
    visitsTotal: visitsTotal ?? 0,
    topSources: [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([source, visits]) => ({ source, visits })),
    clients,
    commissionPendingCents: (commissions ?? []).filter((c) => c.status === "pending").reduce((s, c) => s + Number(c.commission_cents), 0),
    commissionPaidCents: (commissions ?? []).filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.commission_cents), 0),
    months: [...monthMap.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, m]) => ({
        month,
        commissionCents: m.cents,
        status: m.statuses.size > 1 ? "mixed" : (([...m.statuses][0] ?? "pending") as "pending" | "paid"),
      })),
  };
}
