import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileNowPayments, type CryptoPaymentSnapshot } from "./nowpayments-reconciliation";

export async function loadNowPaymentsReconciliation(
  intent: Parameters<typeof reconcileNowPayments>[1],
) {
  const snapshots: CryptoPaymentSnapshot[] = [];
  const admin = createAdminClient();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("webhook_events")
      .select("payload")
      .eq("provider", "crypto")
      .contains("payload", { order_id: intent.id })
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw new Error(`NOWPayments reconciliation: ${error.message}`);
    for (const row of data ?? []) snapshots.push(row.payload as CryptoPaymentSnapshot);
    if (!data || data.length < 500) break;
  }
  return reconcileNowPayments(snapshots, intent);
}
