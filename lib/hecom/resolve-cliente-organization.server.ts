import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Org Holistic donde vive la cartera del cliente Hecom (la del usuario OTP),
 * no la org del gerente/super-admin que “ve como”.
 */
export async function resolveOrganizationIdForHecomCliente(
  hecomClienteIdRaw: string,
): Promise<string | null> {
  const hecomClienteId = hecomClienteIdRaw.trim();
  if (!hecomClienteId) return null;

  const admin = createAdminClient();

  const { data: links } = await admin
    .from("hecom_cliente_user_links")
    .select("user_id")
    .eq("hecom_cliente_id", hecomClienteId)
    .limit(20);

  const userIds = [...new Set((links ?? []).map((row) => String(row.user_id)))];
  if (userIds.length > 0) {
    const { data: memberships } = await admin
      .from("organization_memberships")
      .select("organization_id, user_id, role, created_at")
      .in("user_id", userIds)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    const owner = (memberships ?? []).find((m) => m.role === "owner");
    const pick = owner ?? memberships?.[0];
    if (pick?.organization_id) return String(pick.organization_id);
  }

  const { data: payment } = await admin
    .from("payment_intents")
    .select("organization_id")
    .eq("metadata->>hecom_cliente_id", hecomClienteId)
    .eq("status", "succeeded")
    .order("succeeded_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ organization_id: string }>();

  if (payment?.organization_id) return String(payment.organization_id);

  const { data: adRows } = await admin
    .from("ad_accounts")
    .select("organization_id")
    .eq("platform", "tiktok")
    .eq("metadata->>hecom_cliente_id", hecomClienteId)
    .not("organization_id", "is", null)
    .limit(30);

  const orgIds = [
    ...new Set(
      (adRows ?? [])
        .map((row) => String(row.organization_id ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (orgIds.length === 0) return null;
  if (orgIds.length === 1) return orgIds[0]!;

  const { data: wallets } = await admin
    .from("wallets")
    .select("organization_id, balance_cents")
    .in("organization_id", orgIds)
    .eq("status", "active");

  let bestOrg = orgIds[0]!;
  let bestBal = -1;
  for (const w of wallets ?? []) {
    const bal = Number(w.balance_cents ?? 0);
    if (bal > bestBal) {
      bestBal = bal;
      bestOrg = String(w.organization_id);
    }
  }
  return bestOrg;
}
