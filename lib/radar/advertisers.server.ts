import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapAdvertisersToClientes } from "@/lib/radar/ad-daily-parse";

/**
 * Anunciantes TikTok de clientes Ads Holistic → cliente Hecom.
 * Misma fuente que el sync de gasto (ad_accounts.metadata.hecom_cliente_id).
 */
export async function loadClientAdvertisers(): Promise<{
  byAdvertiser: Map<string, string>;
  conflicts: string[];
}> {
  const admin = createAdminClient();
  const rows: Array<{ advertiserId: string | null; hecomClienteId: string | null }> = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("ad_accounts")
      .select(
        "external_account_id, hecom_cliente_id:metadata->>hecom_cliente_id, hecom_cliente_id_alt:metadata->>hecomClienteId",
      )
      .eq("platform", "tiktok")
      .not("external_account_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`ad_accounts: ${error.message}`);
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      rows.push({
        advertiserId: (row.external_account_id as string | null) ?? null,
        hecomClienteId:
          (row.hecom_cliente_id as string | null) ?? (row.hecom_cliente_id_alt as string | null) ?? null,
      });
    }
    if (!data || data.length < 1000) break;
  }

  return mapAdvertisersToClientes(rows);
}
