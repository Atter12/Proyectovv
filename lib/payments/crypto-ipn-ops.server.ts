import { createAdminClient } from "@/lib/supabase/admin";

/** Señal para ops: pago corto, refund post-crédito, etc. No tira el webhook. */
export async function recordCryptoIpnOpsEvent(input: {
  intentId: string;
  organizationId: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      organization_id: input.organizationId,
      actor_user_id: null,
      action: input.action,
      entity_type: "payment_intent",
      entity_id: input.intentId,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.warn("[crypto-ipn] audit log falló", error);
  }
}
